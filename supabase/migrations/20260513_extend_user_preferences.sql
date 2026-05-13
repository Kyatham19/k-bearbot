-- Extend user_preferences with language, display, notification and brief-schedule fields

do $$ begin
  create type language_mode as enum ('auto', 'english', 'tanglish');
exception when duplicate_object then null;
end $$;

alter table user_preferences
  add column if not exists language_mode     language_mode not null default 'auto',
  add column if not exists show_charts       boolean not null default true,
  add column if not exists show_news_cards   boolean not null default true,
  add column if not exists notif_brief_email boolean not null default true,
  add column if not exists notif_in_app      boolean not null default true,
  add column if not exists daily_brief_time  time not null default '09:00',
  add column if not exists daily_brief_tz    text not null default 'Asia/Kolkata',
  add column if not exists updated_at        timestamptz not null default now();

-- ensure updated_at trigger exists
drop trigger if exists user_preferences_updated_at on user_preferences;
create trigger user_preferences_updated_at
  before update on user_preferences
  for each row execute function update_updated_at_column();

-- Data API exposure (required after May 30 for new projects, Oct 30 for existing)
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.user_preferences to service_role;
