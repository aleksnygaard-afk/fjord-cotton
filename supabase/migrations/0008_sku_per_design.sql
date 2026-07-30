-- 0008_sku_per_design.sql — gjør variant-SKU-er unike per design.
--
-- generate_variants() bygget SKU-en av de åtte første tegnene i slugen:
--
--   'FC-' || upper(left(d.slug, 8)) || '-' || farge || '-' || størrelse
--
-- variants.sku har unique-constraint, så to design med samme åtte første tegn gir
-- identiske SKU-er og det andre feiler med
--
--   duplicate key value violates unique constraint "variants_sku_key"
--
-- Designraden er alt satt inn når det skjer, så resultatet er et design uten
-- varianter, usynlig i butikken, med slugen opptatt. 'host-halloween-katt' og
-- 'host-halloween-gresskar' blir begge 'host-hal', så en temabatch treffer dette
-- på fil nummer to.
--
-- Slug-fragmentet blir stående fordi det gjør SKU-en lesbar i bokføringen; seks
-- hex-tegn av design-ID-en gjør den unik. Utledet, ikke løpenummer, så den er
-- stabil om generate_variants() kjøres på nytt for samme design.
--
--   FC-HOSTHALL-A3F9C1-GARNET-XXL

begin;

create or replace function generate_variants(p_design uuid) returns void as $$
begin
  insert into variants (design_id, color_id, size_id, sku, price)
  select d.id, c.id, s.id,
         'FC-' || upper(left(d.slug, 8)) || '-'
               || upper(left(replace(d.id::text, '-', ''), 6)) || '-'
               || upper(c.key) || '-' || upper(s.key),
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

-- Skriv om SKU-er som alt finnes, så tabellen ikke har to skjemaer om hverandre.
-- Idempotent: uttrykket gir samme verdi hver gang, så den kan kjøres på nytt.
--
-- order_lines.sku røres ikke. Den er en kopi tatt da ordren ble lagt, og en kvittering
-- skal fortsatt vise SKU-en kunden faktisk kjøpte.
update variants v
   set sku = 'FC-' || upper(left(d.slug, 8)) || '-'
                   || upper(left(replace(d.id::text, '-', ''), 6)) || '-'
                   || upper(gc.key) || '-' || upper(gs.key)
  from designs d, garment_colors gc, garment_sizes gs
 where v.design_id = d.id
   and v.color_id = gc.id
   and v.size_id = gs.id;

-- Feiler denne, er det fortsatt kollisjoner og noe annet enn slugen er årsaken.
do $$ begin
  if exists (select 1 from variants group by sku having count(*) > 1) then
    raise exception 'SKU-ene er ikke unike etter migrasjonen';
  end if;
end $$;

commit;
