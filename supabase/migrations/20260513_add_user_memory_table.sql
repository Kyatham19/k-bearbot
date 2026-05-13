-- user_memory: key/value store for AI-extracted user facts (name, preferences mentioned in chat)

create table user_memory (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),

  unique (user_id, key)
);

create index idx_user_memory_user_id on user_memory(user_id);

create trigger user_memory_updated_at
  before update on user_memory
  for each row execute function update_updated_at_column();

-- Data API exposure (required after May 30 for new projects, Oct 30 for existing)
grant select, insert, update, delete on public.user_memory to authenticated;
grant select, insert, update, delete on public.user_memory to service_role;

alter table user_memory enable row level security;

create policy "Users can view their own memory"
  on user_memory for select
  using (auth.uid() = user_id);

create policy "Users can create their own memory"
  on user_memory for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own memory"
  on user_memory for update
  using (auth.uid() = user_id);

create policy "Users can delete their own memory"
  on user_memory for delete
  using (auth.uid() = user_id);
