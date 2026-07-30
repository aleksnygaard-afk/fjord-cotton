-- 0010_gelato_status_default.sql — gi orders.gelato_status default, not null og check.
--
-- En betalt ordre ble aldri sendt til Gelato. Årsaken:
--
--   02g-admin-support.sql:  alter table orders add column if not exists gelato_status text;
--   0007_fulfillment.sql:   alter table orders add column if not exists gelato_status text
--                             not null default 'pending' check (gelato_status in (...));
--
-- 02g ble kjørt først. Da kolonnen alt fantes, ble 0007-setningen en no-op — og
-- «if not exists» gjelder hele setningen, ikke bare kolonnen, så default, not null
-- og check-constraint kom aldri med. Nye ordrer fikk gelato_status = NULL.
--
-- claim_gelato_job() krever gelato_status in ('pending','failed'), eller en
-- 'submitting' som har stått i over ti minutter. NULL matcher ingen av dem, så
-- claimet returnerer false og submitGelatoForOrder() svarer 'not_claimed' — samme
-- svar som når en annen kjøring alt har tatt jobben, og derfor helt uten logging
-- eller varsel. En betalt ordre blir stående usendt, og ingenting sier fra.
--
-- Feilen viste seg først da en ordre ble ført helt fram til betalt for første gang.

begin;

-- Rekkefølgen er tvunget: eksisterende NULL-er må vekk før not null kan settes.
update orders set gelato_status = 'pending' where gelato_status is null;

alter table orders alter column gelato_status set default 'pending';
alter table orders alter column gelato_status set not null;

-- Postgres har ingen «add constraint if not exists», så sjekk pg_constraint først.
-- Constraintet er verdt å ha: uten det kan webhooken skrive en Gelato-status som
-- ikke finnes i vår tilstandsmaskin, og claimet slutter å matche igjen.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'orders'::regclass
      and conname = 'orders_gelato_status_check'
  ) then
    alter table orders add constraint orders_gelato_status_check
      check (gelato_status in ('pending','submitting','submitted','failed','manual_review'));
  end if;
end $$;

commit;

-- Verifisering: ingen NULL-er igjen, og en fersk rad skal få 'pending' av seg selv.
do $$
declare
  v_null int;
  v_default text;
begin
  select count(*) into v_null from orders where gelato_status is null;
  if v_null > 0 then
    raise exception '% ordrer har fortsatt gelato_status NULL', v_null;
  end if;

  select column_default into v_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders' and column_name = 'gelato_status';

  if v_default is null or v_default not like '%pending%' then
    raise exception 'gelato_status har ingen default: %', coalesce(v_default, '(ingen)');
  end if;
end $$;
