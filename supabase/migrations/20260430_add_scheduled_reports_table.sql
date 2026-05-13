-- Add scheduled_reports table

create table scheduled_reports (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  email         text,
  stocks        text[],
  schedule_time text,
  timezone      text,
  is_active     boolean default true,
  created_at    timestamptz not null default now()
);

create index idx_scheduled_reports_user_id on scheduled_reports(user_id);

-- Data API exposure (required after May 30 for new projects, Oct 30 for existing)
grant select, insert, update, delete on public.scheduled_reports to authenticated;
grant select, insert, update, delete on public.scheduled_reports to service_role;

alter table scheduled_reports enable row level security;

create policy "Users can view their own scheduled reports"
  on scheduled_reports for select
  using (auth.uid() = user_id);

create policy "Users can create their own scheduled reports"
  on scheduled_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own scheduled reports"
  on scheduled_reports for update
  using (auth.uid() = user_id);

create policy "Users can delete their own scheduled reports"
  on scheduled_reports for delete
  using (auth.uid() = user_id);
