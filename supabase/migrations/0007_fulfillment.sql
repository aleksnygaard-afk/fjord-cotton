-- Gelato fulfilment state on orders (04-gelato-fulfilment.md).
-- Submission runs as a background job after payment, with retries; these columns
-- track it. gelato_order_id and tracking_url already exist (0001).

alter table orders add column if not exists gelato_status text not null default 'pending'
  check (gelato_status in ('pending','submitting','submitted','failed','manual_review'));
alter table orders add column if not exists gelato_attempts int not null default 0;
alter table orders add column if not exists gelato_last_error text;
alter table orders add column if not exists gelato_submitted_at timestamptz;
alter table orders add column if not exists gelato_claimed_at timestamptz;

-- ── Gelato product mapping ───────────────────────────────────
-- The Gelato product UID encodes colour AND size, e.g.
--   apparel_product_gca_t-shirt_..._gsi_m_gco_black_gpr_4-0
-- Keep the mapping in the database, not in code (04): store a per-colour UID
-- TEMPLATE in garment_colors.gelato_variant_key with a {size} placeholder, e.g.
--   'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_{size}_gco_black_gpr_4-0'
-- and the Gelato size code per size below. resolveGelatoUid() substitutes {size}.
-- (Left NULL here — fill in with the real UIDs for your chosen blank. Until then,
--  real-mode submission flags the order for manual review; mock mode uses a stub.)
alter table garment_sizes add column if not exists gelato_size_code text;

-- Sensible defaults matching our size keys; adjust to the blank's actual codes.
update garment_sizes set gelato_size_code = key where gelato_size_code is null;

create index if not exists orders_gelato_pending_idx
  on orders (status, gelato_status)
  where status = 'paid' and gelato_order_id is null;

-- ── Atomic job claim ─────────────────────────────────────────
-- Ensures a paid order is submitted to Gelato exactly once even with concurrent
-- webhook + cron runs. Reclaims a 'submitting' row stuck > 10 min (crash safety).
-- Returns true if the caller now owns the job.
create or replace function claim_gelato_job(p_order_no text) returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update orders set
    gelato_status = 'submitting',
    gelato_claimed_at = now()
  where order_no = p_order_no
    and status in ('paid', 'in_production', 'shipped')
    and gelato_order_id is null
    and gelato_attempts < 5
    and (
      gelato_status in ('pending', 'failed')
      or (gelato_status = 'submitting' and gelato_claimed_at < now() - interval '10 minutes')
    )
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke execute on function claim_gelato_job(text) from public;
grant execute on function claim_gelato_job(text) to service_role;
