-- Fjord & Cotton — Postgres schema (Supabase compatible)
-- Verbatim from the handoff (02-data-model.sql). Do not alter the handoff contract here;
-- additive changes belong in later migrations.
-- All money is stored in øre (integer) to avoid floating point. 34900 = 349,00 kr.
-- All prices are VAT-INCLUSIVE gross amounts.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- fuzzy search over thousands of titles

-- ─────────────────────────────────────────────────────────────
-- Catalog
-- ─────────────────────────────────────────────────────────────

create table collections (
  id           uuid primary key default gen_random_uuid(),
  key          text unique not null,          -- 'sommer', 'jul', 'mai'
  name_no      text not null,
  name_en      text not null,
  -- months (0-11) in which this collection is featured on the home page
  feature_months smallint[] not null default '{}',
  tile_bg      text not null default '#e9e3d4',
  sort_order   int not null default 0
);

create table themes (
  id       uuid primary key default gen_random_uuid(),
  key      text unique not null,              -- 'natur', 'typografi'
  name_no  text not null,
  name_en  text not null
);

create table designs (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,         -- 'nordlys-001', used in the URL
  title_no      text not null,
  title_en      text,
  description_no text,
  description_en text,
  theme_id      uuid references themes(id),
  collection_id uuid references collections(id),
  -- 349,00 kr default. Per-design so you can price premium art higher.
  base_price    int not null default 34900,
  tile_bg       text not null default '#e9e3d4',
  -- Artwork
  print_file_url text not null,               -- transparent PNG 4500x5400 @300dpi
  mockup_url     text,                        -- generated shirt mockup, 4:5
  detail_url     text,                        -- print close-up, 1:1
  -- Publishing
  status        text not null default 'draft' -- draft | scheduled | published | archived
                check (status in ('draft','scheduled','published','archived')),
  published_at  timestamptz,
  -- Provenance of the generated artwork — keep this, it matters for IP disputes
  prompt        text,
  generator     text,                         -- e.g. 'gpt-image-1'
  created_at    timestamptz not null default now()
);

create index on designs (status, published_at desc);
create index on designs (collection_id) where status = 'published';
create index on designs (theme_id) where status = 'published';
create index on designs using gin (title_no gin_trgm_ops);

-- Garment axes. Kept as tables so you can add hoodies later without a migration.
create table garment_colors (
  id      uuid primary key default gen_random_uuid(),
  key     text unique not null,               -- 'hvit','sort','sand','salvie','marine','rust'
  name_no text not null,
  name_en text not null,
  hex     text not null,
  gelato_variant_key text,                    -- maps to the Gelato product UID
  sort_order int not null default 0
);

create table garment_sizes (
  id    uuid primary key default gen_random_uuid(),
  key   text unique not null,                 -- 'xs','s','m','l','xl','3xl'
  label text not null,
  price_delta int not null default 0,         -- e.g. 3XL +3000 (30 kr)
  sort_order int not null default 0
);

-- Variants are generated, not hand-authored: one row per design × colour × size.
-- 36 designs today = 1 296 rows; 2 000 designs = 72 000 rows. Postgres does not care.
create table variants (
  id         uuid primary key default gen_random_uuid(),
  design_id  uuid not null references designs(id) on delete cascade,
  color_id   uuid not null references garment_colors(id),
  size_id    uuid not null references garment_sizes(id),
  sku        text unique not null,            -- 'FC-0001-SORT-M'
  price      int not null,                    -- resolved gross price in øre
  active     boolean not null default true,
  unique (design_id, color_id, size_id)
);

create index on variants (design_id);

-- ─────────────────────────────────────────────────────────────
-- Orders
-- ─────────────────────────────────────────────────────────────

create table carts (
  id         uuid primary key default gen_random_uuid(),
  -- anonymous carts are fine; the session cookie holds this id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_lines (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references variants(id),
  qty        int not null check (qty > 0),
  unique (cart_id, variant_id)
);

create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      text unique not null,         -- 'FC-2026-104822', shown to the customer
  status        text not null default 'pending'
                check (status in ('pending','paid','in_production','shipped','cancelled','refunded')),

  -- Customer (no account system; email is the identifier)
  email         text not null,
  first_name    text not null,
  last_name     text not null,
  phone         text,
  address1      text not null,
  postcode      text not null,
  city          text not null,
  country       text not null default 'NO'
                check (country in ('NO','SE','DK','FI')),

  -- Money, all gross øre
  subtotal      int not null,
  shipping      int not null,
  total         int not null,
  vat_amount    int not null,                 -- round(total * 0.20) for the 25 % NO rate
  vat_rate      numeric(4,3) not null default 0.250,
  currency      text not null default 'NOK',

  shipping_method text not null,              -- 'pickup' | 'home' | 'express'
  -- Payment (Dintero)
  payment_method  text,                       -- 'vipps' | 'klarna' | 'card' | 'wallet'
  dintero_session_id     text,
  dintero_transaction_id text,
  paid_at       timestamptz,

  -- Fulfilment (Gelato)
  gelato_order_id text,
  tracking_url    text,

  consent_terms boolean not null default false,
  created_at    timestamptz not null default now()
);

create index on orders (status, created_at desc);
create index on orders (email);

-- Snapshot the design at purchase time: titles and prices change, receipts must not.
create table order_lines (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  variant_id   uuid references variants(id),
  sku          text not null,
  title        text not null,
  color_name   text not null,
  size_label   text not null,
  qty          int not null check (qty > 0),
  unit_price   int not null,
  line_total   int not null,
  print_file_url text not null                -- frozen: Gelato must print what was bought
);

-- Audit trail for the daily publishing routine.
create table publish_log (
  id         uuid primary key default gen_random_uuid(),
  design_id  uuid references designs(id) on delete set null,
  action     text not null,                   -- 'created' | 'published' | 'archived'
  actor      text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────

-- Live published count for the home page trust bar.
create view v_published_count as
  select count(*)::int as n from designs where status = 'published';

-- Collection counts for the sidebar and the "I sesong nå" row.
create view v_collection_counts as
  select c.key, c.name_no, c.name_en, c.feature_months, c.tile_bg,
         count(d.id)::int as design_count
  from collections c
  left join designs d on d.collection_id = c.id and d.status = 'published'
  group by c.id;

-- Generate every variant for a design. Call once after inserting a design.
create or replace function generate_variants(p_design uuid) returns void as $$
begin
  insert into variants (design_id, color_id, size_id, sku, price)
  select d.id, c.id, s.id,
         'FC-' || upper(left(d.slug, 8)) || '-' || upper(c.key) || '-' || upper(s.key),
         d.base_price + s.price_delta
  from designs d cross join garment_colors c cross join garment_sizes s
  where d.id = p_design
  on conflict (design_id, color_id, size_id) do nothing;
end;
$$ language plpgsql;

-- Row level security: the storefront reads published data only; writes go through
-- the service role key from server routes.
alter table designs enable row level security;
alter table variants enable row level security;
alter table orders  enable row level security;

create policy "public reads published designs" on designs
  for select using (status = 'published');
create policy "public reads active variants" on variants
  for select using (active = true);
-- No public policy on orders: all order access is server-side.
