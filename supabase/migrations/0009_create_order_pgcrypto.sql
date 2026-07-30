-- 0009_create_order_pgcrypto.sql — la create_order finne gen_random_bytes igjen.
--
-- Kassen svarte 500 på hver ordre:
--
--   function gen_random_bytes(integer) does not exist
--
-- create_order lager access_token med encode(gen_random_bytes(16), 'hex')
-- (0006_orders.sql linje 94), og gen_random_bytes kommer fra pgcrypto. I Supabase
-- installeres utvidelser i skjemaet `extensions`, ikke `public` — og funksjonen er
-- deklarert `security definer set search_path = public`, så den ser bare public.
-- `create extension if not exists "pgcrypto"` i 0001 hjalp ikke: den ble en no-op
-- fordi utvidelsen alt var installert, i det andre skjemaet.
--
-- gen_random_uuid() virker i tabelldefaultene fordi den er innebygd i PostgreSQL
-- 13+, ikke en del av pgcrypto. Det er derfor bare denne ene setningen feilet, og
-- derfor det ikke ble oppdaget før noen faktisk fullførte et kjøp.
--
-- To setninger, ingen kopiering av funksjonskroppen. Fungerer uansett hvor
-- pgcrypto ligger: er den fraværende blir den installert, ligger den i extensions
-- blir den synlig, ligger den alt i public er public uansett i search_path.

begin;

-- Trygg å kjøre om igjen. Er utvidelsen alt installert, ignoreres schema-leddet.
create extension if not exists pgcrypto with schema extensions;

alter function create_order(
  uuid, text, text, text, text, text, text, text, text, text, text, boolean, boolean
) set search_path = public, extensions;

commit;

-- Verifisering. Å kalle create_order med tom kurv duger ikke: den kaster
-- 'empty_cart' lenge før tokenlinjen, så den ville passert uansett. Test i stedet
-- gen_random_bytes under nøyaktig den deklarasjonen create_order har.
create or replace function _sjekk_pgcrypto() returns text
  language plpgsql security definer set search_path = public, extensions
as $$ begin return encode(gen_random_bytes(16), 'hex'); end $$;

do $$ begin
  if length(_sjekk_pgcrypto()) <> 32 then
    raise exception 'gen_random_bytes ga uventet resultat';
  end if;
end $$;

drop function _sjekk_pgcrypto();
