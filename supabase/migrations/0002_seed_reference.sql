-- Reference data: collections, themes, garment colours and sizes.
-- Values transcribed from the design prototype constants (Fjord & Cotton.dc.html)
-- and 01-design-spec.md. Idempotent — safe to re-run.

-- ── Collections (seasons & holidays). feature_months are 0-indexed (Jan = 0). ──
insert into collections (key, name_no, name_en, feature_months, tile_bg, sort_order) values
  ('sommer',    'Sommer',      'Summer',           '{5,6,7}', '#dfe2dc', 1),
  ('host',      'Høst',        'Autumn',           '{8,9}',   '#e7e0d8', 2),
  ('halloween', 'Halloween',   'Halloween',        '{9,10}',  '#e2ddd0', 3),
  ('jul',       'Jul',         'Christmas',        '{10,11}', '#dcdcd4', 4),
  ('nyttar',    'Nyttår',      'New Year',         '{11,0}',  '#e1dcd0', 5),
  ('vinter',    'Vinterferie', 'Winter',           '{0,1}',   '#e4e0d2', 6),
  ('paske',     'Påske',       'Easter',           '{2,3}',   '#e9e3d4', 7),
  ('mai',       '17. mai',     'Constitution Day', '{3,4}',   '#e6e2d0', 8)
on conflict (key) do update set
  name_no = excluded.name_no,
  name_en = excluded.name_en,
  feature_months = excluded.feature_months,
  tile_bg = excluded.tile_bg,
  sort_order = excluded.sort_order;

-- ── Themes ──
insert into themes (key, name_no, name_en) values
  ('natur',     'Natur',     'Nature'),
  ('typografi', 'Typografi', 'Typography'),
  ('retro',     'Retro',     'Retro'),
  ('humor',     'Humor',     'Humour'),
  ('byliv',     'Byliv',     'City'),
  ('abstrakt',  'Abstrakt',  'Abstract'),
  ('musikk',    'Musikk',    'Music')
on conflict (key) do update set
  name_no = excluded.name_no,
  name_en = excluded.name_en;

-- ── Garment colours (6 shirt colours). hex from 01-design-spec.md. ──
-- gelato_variant_key is left null until the Gelato blank is chosen (04-gelato-fulfilment.md).
insert into garment_colors (key, name_no, name_en, hex, sort_order) values
  ('hvit',   'Hvit',   'White', '#f4f2ec', 1),
  ('sort',   'Sort',   'Black', '#1a1a18', 2),
  ('sand',   'Sand',   'Sand',  '#d8cdb6', 3),
  ('salvie', 'Salvie', 'Sage',  '#a9b3a1', 4),
  ('marine', 'Marine', 'Navy',  '#2a3446', 5),
  ('rust',   'Rust',   'Rust',  '#a75c3c', 6)
on conflict (key) do update set
  name_no = excluded.name_no,
  name_en = excluded.name_en,
  hex = excluded.hex,
  sort_order = excluded.sort_order;

-- ── Garment sizes (XS–3XL). 3XL costs Gelato more → +30 kr (3000 øre). ──
insert into garment_sizes (key, label, price_delta, sort_order) values
  ('xs',  'XS',  0,    1),
  ('s',   'S',   0,    2),
  ('m',   'M',   0,    3),
  ('l',   'L',   0,    4),
  ('xl',  'XL',  0,    5),
  ('3xl', '3XL', 3000, 6)
on conflict (key) do update set
  label = excluded.label,
  price_delta = excluded.price_delta,
  sort_order = excluded.sort_order;
