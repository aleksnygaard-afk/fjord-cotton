-- 0011_payment_provider_neutral.sql — bytt betalingsleverandør fra Dintero til Stripe.
--
-- Kolonnene het dintero_session_id og dintero_transaction_id. De holder nå en
-- Stripe Checkout-session og en PaymentIntent, og skal senere kunne holde en
-- Vipps-ordre uten at kolonnene må døpes om igjen. Derfor nøytrale navn.
--
-- mark_order_paid() må redefineres i samme migrasjon: plpgsql-kroppen slår opp
-- kolonnenavn ved kjøring, så funksjonen slutter å virke i det sekundet kolonnen
-- får nytt navn. Kroppen er ordrett den fra 0006_orders.sql, med ett navn endret.

begin;

alter table orders rename column dintero_session_id     to payment_session_id;
alter table orders rename column dintero_transaction_id to payment_transaction_id;

create or replace function mark_order_paid(
  p_order_no       text,
  p_transaction_id text,
  p_amount         int,
  p_payment_method text
) returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_order   orders%rowtype;
  v_updated uuid;
begin
  select * into v_order from orders where order_no = p_order_no;
  if not found then
    return json_build_object('status', 'not_found');
  end if;

  -- Already progressed past pending → idempotent no-op.
  if v_order.status in ('paid', 'in_production', 'shipped') then
    return json_build_object('status', 'already_paid', 'order_no', v_order.order_no);
  end if;

  if v_order.status in ('cancelled', 'refunded') then
    return json_build_object('status', v_order.status, 'order_no', v_order.order_no);
  end if;

  -- Authorised amount must match the total we computed and sent.
  if p_amount is not null and p_amount <> v_order.total then
    return json_build_object(
      'status', 'amount_mismatch',
      'expected', v_order.total,
      'got', p_amount);
  end if;

  update orders set
    status = 'paid',
    paid_at = now(),
    payment_transaction_id = coalesce(p_transaction_id, payment_transaction_id),
    payment_method = coalesce(nullif(p_payment_method, ''), payment_method)
  where id = v_order.id and status = 'pending'
  returning id into v_updated;

  if v_updated is null then
    -- Lost the race to a concurrent retry — treat as idempotent success.
    return json_build_object('status', 'already_paid', 'order_no', v_order.order_no);
  end if;

  return json_build_object(
    'status', 'paid',
    'order_no', v_order.order_no,
    'order_id', v_order.id);
end;
$$;

revoke execute on function mark_order_paid(text, text, int, text) from public;
grant  execute on function mark_order_paid(text, text, int, text) to service_role;

-- 'vipps' er ute av PaymentMethod i koden fordi Stripe ikke tilbyr Vipps. Gamle
-- ordrer skal beholde verdien sin — en kvittering skal vise hva kunden faktisk
-- brukte — så det finnes ingen constraint å rydde, og ingen data å skrive om.
comment on column orders.payment_method is
  'Kundens valg ved kassen: card, klarna, wallet. Historiske ordrer kan ha vipps.';

commit;

-- Verifisering: funksjonen må kunne kjøre mot det nye kolonnenavnet.
do $$
declare
  v_svar json;
begin
  v_svar := mark_order_paid('FC-FINNES-IKKE', null, null, null);
  if v_svar->>'status' is distinct from 'not_found' then
    raise exception 'mark_order_paid svarte uventet: %', v_svar;
  end if;
end $$;
