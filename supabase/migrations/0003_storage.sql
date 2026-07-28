-- Storage buckets for artwork (04-gelato-fulfilment.md).
--
--   print-files : the transparent 4500×5400 print PNGs. PRIVATE — this is the
--                 sellable IP; never let it be downloaded for free. Gelato and
--                 receipts fetch it via short-lived signed URLs at order time.
--   mockups     : generated shirt mockups + print close-ups shown in the store.
--                 PUBLIC read — they are derived, low-res and safe to expose.
--
-- Writes to both buckets happen only from server routes using the service role
-- key, so no INSERT/UPDATE policies are granted to anon/authenticated.

insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', false)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('mockups', 'mockups', true)
on conflict (id) do update set public = excluded.public;

-- Public read on mockups only. (A bucket flagged public already serves objects,
-- but the explicit policy makes intent clear and survives bucket flag changes.)
drop policy if exists "public reads mockups" on storage.objects;
create policy "public reads mockups" on storage.objects
  for select using (bucket_id = 'mockups');
