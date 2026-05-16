-- ai_memories: vector-indexed semantic memory layer for AI chat (mem0-style).
-- Stores free-form user facts extracted from chat turns. Retrieved via cosine
-- similarity to inject into the LLM system prompt for personalization.

create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table ai_memories (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  memory     text not null,
  embedding  vector(1024),                         -- mistral-embed dim
  category   text,                                 -- e.g. preference, holding_intent, risk_profile, personal
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_memories_user_id on ai_memories(user_id);
create index idx_ai_memories_embedding
  on ai_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create trigger ai_memories_updated_at
  before update on ai_memories
  for each row execute function update_updated_at_column();

-- Data API exposure
grant select, insert, update, delete on public.ai_memories to authenticated;
grant select, insert, update, delete on public.ai_memories to service_role;

alter table ai_memories enable row level security;

create policy "Users can view their own ai_memories"
  on ai_memories for select
  using (auth.uid() = user_id);

create policy "Users can create their own ai_memories"
  on ai_memories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own ai_memories"
  on ai_memories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own ai_memories"
  on ai_memories for delete
  using (auth.uid() = user_id);

-- Top-K cosine similarity search scoped to a user.
-- SECURITY INVOKER: RLS policies above still apply, so callers can only match
-- their own rows even though match_user_id is passed explicitly.
create or replace function match_ai_memories(
  query_embedding      vector(1024),
  match_user_id        uuid,
  match_count          int default 5,
  similarity_threshold float default 0.75
)
returns table (
  id         uuid,
  memory     text,
  category   text,
  metadata   jsonb,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.memory,
    m.category,
    m.metadata,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at,
    m.updated_at
  from ai_memories m
  where m.user_id = match_user_id
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= similarity_threshold
  order by m.embedding <=> query_embedding asc
  limit match_count;
$$;

grant execute on function match_ai_memories(vector, uuid, int, float) to authenticated;
grant execute on function match_ai_memories(vector, uuid, int, float) to service_role;
