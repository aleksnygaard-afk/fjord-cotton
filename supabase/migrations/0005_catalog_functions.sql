-- Catalog facets in a single call, for the home trust bar and the catalog
-- sidebar (01-design-spec.md, 03-api-and-payments.md /api/facets & /api/collections).
--
-- Returns the live published count plus, for every collection and theme, the
-- number of PUBLISHED designs — so the sidebar can show counts and the home page
-- can hide zero-product collections. Collections/themes with zero published
-- designs are still returned (with design_count 0); the caller filters.
--
-- SECURITY DEFINER + a pinned search_path so the published-count aggregate is
-- computed consistently regardless of the caller's RLS view. It exposes only
-- aggregate counts and public catalog metadata — no customer or order data.
create or replace function catalog_facets()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'published_count',
      (select count(*)::int from designs where status = 'published'),
    'collections', coalesce((
      select json_agg(row_to_json(c) order by c.sort_order)
      from (
        select col.key, col.name_no, col.name_en, col.tile_bg,
               col.feature_months, col.sort_order,
               count(d.id) filter (where d.status = 'published')::int as design_count
        from collections col
        left join designs d on d.collection_id = col.id
        group by col.id
      ) c
    ), '[]'::json),
    'themes', coalesce((
      select json_agg(row_to_json(t) order by t.name_no)
      from (
        select th.key, th.name_no, th.name_en,
               count(d.id) filter (where d.status = 'published')::int as design_count
        from themes th
        left join designs d on d.theme_id = th.id
        group by th.id
      ) t
    ), '[]'::json),
    'colors', coalesce((
      select json_agg(row_to_json(gc) order by gc.sort_order)
      from (
        select key, name_no, name_en, hex, sort_order from garment_colors
      ) gc
    ), '[]'::json),
    'sizes', coalesce((
      select json_agg(row_to_json(gs) order by gs.sort_order)
      from (
        select key, label, sort_order from garment_sizes
      ) gs
    ), '[]'::json)
  );
$$;

grant execute on function catalog_facets() to anon, authenticated;
