alter table scheduled_reports
  add column if not exists last_sent_at timestamptz;

create index if not exists idx_scheduled_reports_last_sent_at
  on scheduled_reports(last_sent_at);
