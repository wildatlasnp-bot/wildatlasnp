create table scan_history (
  id uuid primary key default gen_random_uuid(),
  permit_id text not null,
  park_code text not null,
  permit_type text not null,
  scanned_at timestamptz not null default now(),
  availability_found boolean not null
);

create index scan_history_permit_id_idx on scan_history (permit_id);
create index scan_history_scanned_at_idx on scan_history (scanned_at);

alter table scan_history enable row level security;

create policy "Service role full access"
  on scan_history
  for all
  using (true)
  with check (true);
