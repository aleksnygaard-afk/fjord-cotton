-- Fix a latent bug in the handoff generate_variants (0001_schema.sql).
--
-- The original builds the SKU from `upper(left(d.slug, 8))`. Two designs whose
-- slugs share the first 8 characters — e.g. 'design-001' and 'design-002' both
-- truncate to 'DESIGN-0', or 'sommernatt-001' / 'sommernatt-002' → 'SOMMERNA' —
-- produce identical SKUs. `variants.sku` is UNIQUE, so generating variants for
-- the second such design throws a unique_violation and the admin upload fails.
-- The `on conflict (design_id, color_id, size_id)` guard does NOT cover it,
-- because the collision is on `sku`, across different designs.
--
-- Slugs are globally unique, so building the SKU from the full slug removes the
-- collision entirely while keeping the FC-<slug>-<COLOR>-<SIZE> shape.
create or replace function generate_variants(p_design uuid) returns void as $$
begin
  insert into variants (design_id, color_id, size_id, sku, price)
  select d.id, c.id, s.id,
         'FC-' || upper(d.slug) || '-' || upper(c.key) || '-' || upper(s.key),
         d.base_price + s.price_delta
  from designs d cross join garment_colors c cross join garment_sizes s
  where d.id = p_design
  on conflict (design_id, color_id, size_id) do nothing;
end;
$$ language plpgsql;
