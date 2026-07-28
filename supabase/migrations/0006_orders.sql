-- Order creation + payment state machine (03-api-and-payments.md).
--
-- All money is integer øre. Totals are computed HERE, server-side, from the
-- variants table — never trusted from the client. The Dintero `amount` the route
-- sends must equal orders.total written here.

-- Short-lived read token for the confirmation page (03: "token-guarded").
alter table orders add column if not exists access_token text;

-- ── Sequential order numbers ─────────────────────────────────
-- Bokføringsloven wants sequential numbers; a random suffix is not compliant
-- (05-norwegian-compliance.md). FC-<year>-<zero-padded sequence>.
create sequence if not exists order_no_seq;

create or replace function next_order_no() returns text
language sql
volatile
as $$
  select 'FC-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('order_no_seq')::text, 6, '0');
$$;

-- ── create_order ─────────────────────────────────────────────
-- Re-reads the cart, re-prices every line from `variants`, computes shipping and
-- VAT, and inserts the order + a frozen snapshot of its lines. Returns the order
-- and lines as JSON. SECURITY DEFINER + service_role-only (never called by anon).
create or replace function create_order(
  p_cart            uuid,
  p_email           text,
  p_first           text,
  p_last            text,
  p_phone           text,
  p_address1        text,
  p_postcode        text,
  p_city            text,
  p_country         text,
  p_shipping_method text,
  p_payment_method  text,
  p_consent         boolean,
  p_vat_registered  boolean
) returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_subtotal int;
  v_shipping int;
  v_total    int;
  v_vat      int;
  v_vat_rate numeric(4,3);
  v_order_no text;
  v_order_id uuid;
  v_token    text;
begin
  if p_shipping_method not in ('pickup', 'home', 'express') then
    raise exception 'invalid_shipping_method';
  end if;
  if p_consent is not true then
    raise exception 'consent_required';
  end if;

  -- Authoritative re-price from variants.
  select coalesce(sum(v.price * cl.qty), 0) into v_subtotal
  from cart_lines cl
  join variants v on v.id = cl.variant_id and v.active = true
  where cl.cart_id = p_cart;

  if v_subtotal <= 0 then
    raise exception 'empty_cart';
  end if;

  -- Shipping: pickup 0, home 5900, express 14900; free at subtotal >= 59900.
  v_shipping := case
    when v_subtotal >= 59900 then 0
    when p_shipping_method = 'home' then 5900
    when p_shipping_method = 'express' then 14900
    else 0
  end;
  v_total := v_subtotal + v_shipping;

  -- VAT is only charged/recorded once registration is approved
  -- (05-norwegian-compliance.md). Prices are gross either way.
  if p_vat_registered then
    v_vat := round(v_total * 0.20);
    v_vat_rate := 0.250;
  else
    v_vat := 0;
    v_vat_rate := 0.000;
  end if;

  v_order_no := next_order_no();
  v_token := encode(gen_random_bytes(16), 'hex');

  insert into orders (
    order_no, status, email, first_name, last_name, phone,
    address1, postcode, city, country,
    subtotal, shipping, total, vat_amount, vat_rate, currency,
    shipping_method, payment_method, consent_terms, access_token
  ) values (
    v_order_no, 'pending', p_email, p_first, p_last, nullif(p_phone, ''),
    p_address1, p_postcode, p_city, coalesce(nullif(p_country, ''), 'NO'),
    v_subtotal, v_shipping, v_total, v_vat, v_vat_rate, 'NOK',
    p_shipping_method, p_payment_method, p_consent, v_token
  ) returning id into v_order_id;

  -- Snapshot the lines: titles, prices and the print file are frozen at purchase
  -- time (02/04) — receipts and Gelato must reflect what was bought.
  insert into order_lines (
    order_id, variant_id, sku, title, color_name, size_label,
    qty, unit_price, line_total, print_file_url
  )
  select v_order_id, v.id, v.sku, d.title_no, gc.name_no, gs.label,
         cl.qty, v.price, v.price * cl.qty, d.print_file_url
  from cart_lines cl
  join variants v on v.id = cl.variant_id
  join designs d on d.id = v.design_id
  join garment_colors gc on gc.id = v.color_id
  join garment_sizes gs on gs.id = v.size_id
  where cl.cart_id = p_cart;

  return (
    select json_build_object(
      'order', row_to_json(o),
      'lines', coalesce(
        (select json_agg(row_to_json(ol) order by ol.id)
         from order_lines ol where ol.order_id = v_order_id),
        '[]'::json)
    )
    from orders o where o.id = v_order_id
  );
end;
$$;

-- ── mark_order_paid ──────────────────────────────────────────
-- The ONLY place an order becomes 'paid' (03). Idempotent (webhooks retry) and
-- atomic: the guarded UPDATE transitions pending→paid exactly once. Rejects an
-- authorised amount that does not equal the server-computed total.
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
    dintero_transaction_id = coalesce(p_transaction_id, dintero_transaction_id),
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

-- Storefront/anon must never create or pay orders — server (service_role) only.
revoke execute on function create_order(uuid, text, text, text, text, text, text, text, text, text, text, boolean, boolean) from public;
revoke execute on function mark_order_paid(text, text, int, text) from public;
grant execute on function create_order(uuid, text, text, text, text, text, text, text, text, text, text, boolean, boolean) to service_role;
grant execute on function mark_order_paid(text, text, int, text) to service_role;
