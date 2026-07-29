-- Generert av seed-gelato-uids.mjs — ikke rediger for hånd.
-- Mal: ae6a49fc-7111-402a-ad37-55d40da6ef02
-- Kjørt: 2026-07-29T07:44:36.539Z

-- {size} erstattes med størrelsesnøkkelen ved ordre. Se resolveGelatoUid().
begin;
update garment_colors set gelato_variant_key = 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_heavy-weight_gsi_{size}_gco_white_gpr_4-0-dtf_gildan_5000' where key = 'hvit';
update garment_colors set gelato_variant_key = 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_heavy-weight_gsi_{size}_gco_sand_gpr_4-0-dtf_gildan_5000' where key = 'sand';
update garment_colors set gelato_variant_key = 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_heavy-weight_gsi_{size}_gco_black_gpr_4-0-dtf_gildan_5000' where key = 'sort';
update garment_colors set gelato_variant_key = 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_heavy-weight_gsi_{size}_gco_navy_gpr_4-0-dtf_gildan_5000' where key = 'marine';
update garment_colors set gelato_variant_key = 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_heavy-weight_gsi_{size}_gco_military-green_gpr_4-0-dtf_gildan_5000' where key = 'oliven';
update garment_colors set gelato_variant_key = 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_heavy-weight_gsi_{size}_gco_garnet_gpr_4-0-dtf_gildan_5000' where key = 'garnet';

-- Feiler denne, mangler en farge en UID og ville feilet stille ved ordre.
do $$ begin
  if exists (select 1 from garment_colors where gelato_variant_key is null
             or gelato_variant_key not like '%{size}%') then
    raise exception 'Én eller flere farger mangler et gyldig UID-mønster';
  end if;
end $$;
commit;

