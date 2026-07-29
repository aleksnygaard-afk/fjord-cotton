-- Fjord & Cotton — migration: final Gildan 5000 palette and size run
-- Run after 02e-design-colors.sql.
--
-- The blank is Gildan 5000 Heavy Cotton. Two things the original seed got wrong:
--
--   1. Colours. Every colourway must be 100 % cotton, because the shop says so.
--      Excluded for that reason: Sport Grey (90/10), all heathers, Russet,
--      Blackberry, Midnight, Lilac, Sunset, Tweed, safety and neon colours.
--   2. Sizes. Gildan 5000 does not exist in XS. It runs S–5XL; we stock S–4XL
--      because Military Green is not available in 5XL, and a size missing in one
--      colour produces orders that fail silently at Gelato.

begin;

-- ─────────────────────────────────────────────────────────────
-- Colours
-- ─────────────────────────────────────────────────────────────

-- 'salvie' and 'rust' had no 100 %-cotton equivalent in this blank. Military Green
-- and Garnet replace them. Renaming the keys rather than adding new rows keeps any
-- existing variants and order lines attached.
update garment_colors set key = 'oliven', name_no = 'Oliven', name_en = 'Military Green',
       hex = '#4b5140' where key = 'salvie';
update garment_colors set key = 'garnet', name_no = 'Garnet', name_en = 'Garnet',
       hex = '#6e2632' where key = 'rust';

-- Hex values matched to the actual Gildan swatches, not the original design mockup.
update garment_colors set hex = '#f4f2ec', name_en = 'White'  where key = 'hvit';
update garment_colors set hex = '#d9cdb4', name_en = 'Sand'   where key = 'sand';
update garment_colors set hex = '#232f43', name_en = 'Navy'   where key = 'marine';
update garment_colors set hex = '#1a1a18', name_en = 'Black'  where key = 'sort';

-- Catalog order: light to dark. This is the order swatches appear on a product page
-- and the order design_colors() returns.
update garment_colors set sort_order = 1 where key = 'hvit';
update garment_colors set sort_order = 2 where key = 'sand';
update garment_colors set sort_order = 3 where key = 'oliven';
update garment_colors set sort_order = 4 where key = 'garnet';
update garment_colors set sort_order = 5 where key = 'marine';
update garment_colors set sort_order = 6 where key = 'sort';

-- ─────────────────────────────────────────────────────────────
-- Sizes
-- ─────────────────────────────────────────────────────────────

-- XS becomes 4XL. Same row count, so variant maths and the seed script's size check
-- are unchanged.
update garment_sizes set key = '4xl', label = '4XL', sort_order = 7, price_delta = 5000
  where key = 'xs';

-- Gelato charges more for the big sizes; price_delta is in øre.
update garment_sizes set price_delta = 0    where key in ('s','m','l','xl');
update garment_sizes set price_delta = 3000 where key in ('xxl','3xl');

-- 'xxl' is our key for Gildan's 2XL. Label it the way the shirt is labelled.
update garment_sizes set label = '2XL' where key = 'xxl';

-- ─────────────────────────────────────────────────────────────
-- Contrast strategies follow the new palette
-- ─────────────────────────────────────────────────────────────

-- Only two genuinely light shirts now, and four dark ones. Sand is light enough that
-- bone-white art disappears on it.
create or replace function colors_for_contrast(p contrast_strategy)
returns text[] language sql immutable as $$
  select case p
    when 'light_safe' then array['hvit','sand']
    when 'dark_safe'  then array['oliven','garnet','marine','sort']
    else null::text[]
  end;
$$;

-- Designs already restricted by the old keys need remapping.
update designs set allowed_colors = colors_for_contrast(contrast)
  where allowed_colors is not null;

commit;

-- Re-run variant generation for every design so SKUs pick up the new keys and the
-- 4XL row exists. Safe to run repeatedly.
select generate_variants(id) from designs;

-- Sanity check. Six colours, seven sizes, no blends.
--   select key, name_no, hex, sort_order from garment_colors order by sort_order;
--   select key, label, price_delta from garment_sizes order by sort_order;
--
-- Then re-run scripts/seed-gelato-uids.mjs — the colour keys it writes to have changed.
