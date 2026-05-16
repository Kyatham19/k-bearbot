-- Harden ai_memories for production deploy:
-- 1) Guard uuid-ossp (parent migration assumed it but never re-declared)
-- 2) Swap IVFFlat → HNSW (works with 0 rows, no analyze step needed,
--    better recall at default m=16, ef_construction=64)
-- 3) Cap memory text + category length so a misbehaving extractor cannot
--    write multi-KB rows
-- 4) Analyze the table for fresh planner stats

create extension if not exists "uuid-ossp";

drop index if exists idx_ai_memories_embedding;
create index idx_ai_memories_embedding
  on ai_memories using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

alter table ai_memories
  add constraint ai_memories_memory_len_chk
  check (char_length(memory) between 1 and 500);

alter table ai_memories
  add constraint ai_memories_category_len_chk
  check (category is null or char_length(category) between 1 and 32);

analyze ai_memories;
