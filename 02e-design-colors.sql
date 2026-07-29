-- Fjord & Cotton — migration: per-design colour restriction
-- Run after 02d-gelato-mockups.sql.
--
-- Not every design works on every shirt. A black silhouette disappears on the black
-- shirt; bone-white line art disappears on white. This migration lets a design declare
-- which garment colours it may be sold in, and makes generate_variants() respect it.
--
-- Default is all six colours, so existing designs are unaffected.

-- ─────────────────────────────────────────────────────────────
-- 1. Which colours a design allows
-- ─────────────────────────────────────────────────────────────

-- Stored as an array of garment_colors.key. An array rather than a join table because
-- it is read on every product page and never queried from the colour side.
alter table designs add column if not exists allowed_colors text[];

comment on column designs.allowed_colors is
  'garment_colors.key values this design may be sold in. NULL = all colours.';

-- A shorthand for the three strategies in design_prompts/00-promptmal.md. Purely
-- descriptive — allowed_colors is what actually governs the catalog.
do $$ begin
  create type contrast_strategy as enum ('light_safe', 'dark_safe', 'neutral');
exception when duplicate_object then null; end $$;

alter table designs add column if not exists contrast contrast_strategy not null default 'neutral';

-- Every key must be a real colour. Catches a typo at insert time instead of producing
-- a design that is quietly unbuyable.
create or replace function validate_allowed_colors()
returns trigger language plpgsql as $$
declare bad text;
begin
  if new.allowed_colors is null then return new; end if;

  if array_length(new.allowed_colors, 1) is null then
    raise exception 'allowed_colors cannot be an empty array — use NULL for all colours';
  end if;

  select k into bad
  from unnest(new.allowed_colors) k
  where not exists (select 1 from garment_colors gc where gc.key = k);

  if bad is not null then
    raise exception 'allowed_colors contains unknown garment colour: %', bad;
  end if;

  return new;
end $$;

drop trigger if exists designs_validate_colors on designs;
create trigger designs_validate_colors
  before insert or update of allowed_colors on designs
  for each row execute function validate_allowed_colors();

-- ─────────────────────────────────────────────────────────────
-- 2. Default colour sets per strategy
-- ─────────────────────────────────────────────────────────────

-- Lets the admin pick a strategy and get the colours filled in, rather than ticking
-- boxes ten times a day.
create or replace function colors_for_contrast(p contrast_strategy)
returns text[] language sql immutable as $$
  select case p
    when 'light_safe' then array['hvit','sand','salvie']
    when 'dark_safe'  then array['sort','marine','rust']
    else null::text[]                      -- neutral: every colour
  end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. generate_variants() now honours the restriction
-- ─────────────────────────────────────────────────────────────

-- Replaces the version in 02-data-model.sql. Same signature, same call site.
-- Safe to re-run: it also deactivates variants that a narrowed restriction now excludes.
create or replace function generate_variants(p_design uuid) returns void as $$
begin
  insert into variants (design_id, color_id, size_id, sku, price)
  select d.id, c.id, s.id,
         'FC-' || upper(left(d.slug, 8)) || '-' || upper(c.key) || '-' || upper(s.key),
         d.base_price + s.price_delta
  from designs d
  cross join garment_colors c
  cross join garment_sizes s
  where d.id = p_design
    and (d.allowed_colors is null or c.key = any(d.allowed_colors))
  on conflict (design_id, color_id, size_id) do nothing;

  -- Widening a restriction re-activates rows that were switched off earlier.
  update variants v set active = true
  from designs d, garment_colors c
  where v.design_id = p_design and d.id = p_design and c.id = v.color_id
    and (d.allowed_colors is null or c.key = any(d.allowed_colors))
    and v.active = false;

  -- Narrowing deactivates rather than deletes: order_lines reference variants, and a
  -- receipt for a colour you stopped selling must still resolve.
  update variants v set active = false
  from designs d, garment_colors c
  where v.design_id = p_design and d.id = p_design and c.id = v.color_id
    and d.allowed_colors is not null
    and not (c.key = any(d.allowed_colors))
    and v.active = true;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 4. Colours the storefront should offer for one design
-- ─────────────────────────────────────────────────────────────

-- The product page calls this instead of listing garment_colors. Returns only colours
-- with at least one active variant, so it stays correct even if a variant is disabled
-- by hand.
create or replace function design_colors(p_design uuid)
returns table (key text, name_no text, name_en text, hex text, sort_order int)
language sql stable security definer set search_path = public as $$
  select distinct gc.key, gc.name_no, gc.name_en, gc.hex, gc.sort_order
  from variants v
  join garment_colors gc on gc.id = v.color_id
  where v.design_id = p_design and v.active = true
  order by gc.sort_order;
$$;

grant execute on function design_colors(uuid) to anon, authenticated, service_role;
grant execute on function colors_for_contrast(contrast_strategy) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. Mockups follow the same restriction
-- ─────────────────────────────────────────────────────────────

-- The Gelato product template covers all six colours, so it returns six mockups. Only
-- store the ones this design is actually sold in — otherwise the product page shows a
-- colour swatch the customer cannot buy.
create or replace view design_mockups_visible as
  select dm.*
  from design_mockups dm
  join designs d on d.id = dm.design_id
  join garment_colors gc on gc.id = dm.color_id
  where d.allowed_colors is null or gc.key = any(d.allowed_colors);

grant select on design_mockups_visible to anon, authenticated;

-- The primary mockup must be a colour the design is sold in. A dark_safe design whose
-- tile shows the white shirt is worse than no tile.
create or replace function repair_primary_mockup(p_design uuid) returns void as $$
begin
  if not exists (
    select 1 from design_mockups_visible where design_id = p_design and is_primary
  ) then
    update design_mockups set is_primary = false where design_id = p_design;
    update design_mockups set is_primary = true
    where id = (
      select dm.id from design_mockups_visible dm
      join garment_colors gc on gc.id = dm.color_id
      where dm.design_id = p_design
      order by gc.sort_order limit 1
    );
  end if;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 6. Backfill
-- ─────────────────────────────────────────────────────────────

-- Existing designs stay on all six colours. Set a strategy per design from the admin
-- page as you review the catalog:
--
--   update designs
--      set contrast = 'dark_safe',
--          allowed_colors = colors_for_contrast('dark_safe')
--    where slug = 'nattravn-008';
--   select generate_variants(id) from designs where slug = 'nattravn-008';
--   select repair_primary_mockup(id) from designs where slug = 'nattravn-008';
--
-- Always call generate_variants() after changing allowed_colors. Nothing else does.
