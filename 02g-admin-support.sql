-- Fjord & Cotton — tables the admin and webhook code needs.
-- Run after 02f-final-palette.sql.

-- Webhook idempotency. Gelato events are unordered and can duplicate; the event id is
-- the only stable key. Also a plain audit log when something goes wrong in production.
create table if not exists gelato_events (
  id         uuid primary key default gen_random_uuid(),
  event_id   text unique not null,
  event_type text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists gelato_events_type_idx on gelato_events(event_type, created_at desc);

-- Set by the webhook, cleared by the sync job. Lets the cron prioritise designs Gelato
-- has actually told us about, instead of polling everything.
alter table designs add column if not exists mockup_sync_due boolean not null default false;

-- Order-side fields the webhook writes.
alter table orders add column if not exists gelato_status text;
alter table orders add column if not exists tracking_code text;
alter table orders add column if not exists tracking_url  text;

-- A paid order that will never be printed is the one failure that costs a customer.
-- Flag it loudly rather than retrying.
alter table orders add column if not exists needs_review boolean not null default false;
alter table orders add column if not exists review_note  text;

create index if not exists orders_needs_review_idx on orders(needs_review) where needs_review;

-- Designs waiting on a mockup, for the sync job.
create index if not exists designs_mockup_pending_idx
  on designs(mockup_status) where mockup_status = 'pending';

-- Nothing public reads these.
alter table gelato_events enable row level security;
