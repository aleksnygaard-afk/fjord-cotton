-- Fjord & Cotton — catalog_facets()
-- Called by /api/facets. Returns one jsonb object with every sidebar facet
-- and its count of PUBLISHED designs. Colours and sizes are garment axes, so
-- their counts are the published total, not a per-axis subset.
--
-- Run this in the Supabase SQL Editor after 02-data-model.sql and 02b-seed.sql.

create or replace function catalog_facets()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with published as (
    select id, collection_id, theme_id
    from designs
    where status = 'published'
  ),
  total as (
    select count(*)::int as n from published
  )
  select jsonb_build_object(
    'total', (select n from total),

    'collections', coalesce((
      select jsonb_agg(x order by x_sort, x_key)
      from (
        select c.sort_order as x_sort,
               c.key        as x_key,
               jsonb_build_object(
                 'key', c.key,
                 'name_no', c.name_no,
                 'name_en', c.name_en,
                 'tile_bg', c.tile_bg,
                 'feature_months', c.feature_months,
                 'count', count(p.id)::int
               ) as x
        from collections c
        left join published p on p.collection_id = c.id
        group by c.id, c.sort_order, c.key, c.name_no, c.name_en,
                 c.tile_bg, c.feature_months
      ) s
    ), '[]'::jsonb),

    'themes', coalesce((
      select jsonb_agg(x order by x_key)
      from (
        select t.key as x_key,
               jsonb_build_object(
                 'key', t.key,
                 'name_no', t.name_no,
                 'name_en', t.name_en,
                 'count', count(p.id)::int
               ) as x
        from themes t
        left join published p on p.theme_id = t.id
        group by t.id, t.key, t.name_no, t.name_en
      ) s
    ), '[]'::jsonb),

    'colors', coalesce((
      select jsonb_agg(x order by x_sort, x_key)
      from (
        select gc.sort_order as x_sort,
               gc.key        as x_key,
               jsonb_build_object(
                 'key', gc.key,
                 'name_no', gc.name_no,
                 'name_en', gc.name_en,
                 'hex', gc.hex,
                 'count', (select n from total)
               ) as x
        from garment_colors gc
      ) s
    ), '[]'::jsonb),

    'sizes', coalesce((
      select jsonb_agg(x order by x_sort, x_key)
      from (
        select gs.sort_order as x_sort,
               gs.key        as x_key,
               jsonb_build_object(
                 'key', gs.key,
                 'label', gs.label,
                 'price_delta', gs.price_delta,
                 'count', (select n from total)
               ) as x
        from garment_sizes gs
      ) s
    ), '[]'::jsonb)
  );
$$;

-- The storefront calls this with the anon key, so the anon role needs execute.
grant execute on function catalog_facets() to anon, authenticated, service_role;
