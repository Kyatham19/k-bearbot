-- Add memories table for user AI memory layer

create extension if not exists "uuid-ossp";

create table if not exists memories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  metadata jsonb,
  embedding text,
  created_at timestamptz not null default now()
);

create index if not exists idx_memories_user_id on memories(user_id);
create index if not exists idx_memories_created_at on memories(created_at);
