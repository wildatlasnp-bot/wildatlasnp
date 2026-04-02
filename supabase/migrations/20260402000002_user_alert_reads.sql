create table user_alert_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references park_alerts(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

alter table user_alert_reads enable row level security;

create policy "Users can read their own alert reads"
  on user_alert_reads for select
  using (auth.uid() = user_id);

create policy "Users can insert their own alert reads"
  on user_alert_reads for insert
  with check (auth.uid() = user_id);

create index idx_user_alert_reads_user_id on user_alert_reads (user_id);
