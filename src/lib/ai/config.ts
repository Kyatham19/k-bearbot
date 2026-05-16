function num(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

export const AGENT_CONFIG = {
  stock: {
    temp:      num(process.env.AGENT_STOCK_TEMP, 0.6),
    maxTokens: num(process.env.AGENT_STOCK_MAX_TOKENS, 8192),
    streaming: bool(process.env.AGENT_STOCK_STREAM, true),
    timeoutMs: num(process.env.AGENT_STOCK_TIMEOUT_MS, 120_000),
  },
  general: {
    temp:           num(process.env.AGENT_GENERAL_TEMP, 0.6),
    maxTokens:      num(process.env.AGENT_GENERAL_MAX_TOKENS, 2048),
    briefTemp:      num(process.env.AGENT_GENERAL_BRIEF_TEMP, 0.8),
    briefMaxTokens: num(process.env.AGENT_GENERAL_BRIEF_MAX_TOKENS, 140),
    streaming:      bool(process.env.AGENT_GENERAL_STREAM, true),
    timeoutMs:      num(process.env.AGENT_GENERAL_TIMEOUT_MS, 120_000),
  },
  brief: {
    temp:      num(process.env.AGENT_BRIEF_TEMP, 0.6),
    maxTokens: num(process.env.AGENT_BRIEF_MAX_TOKENS, 3000),
    timeoutMs: num(process.env.AGENT_BRIEF_TIMEOUT_MS, 90_000),
  },
  memory: {
    // Top-K memories returned by semantic search and injected into the prompt.
    searchLimit:         num(process.env.MEMORY_SEARCH_LIMIT, 5),
    // Minimum cosine similarity for retrieved memories (0..1).
    similarityThreshold: num(process.env.MEMORY_SIMILARITY_THRESHOLD, 0.75),
    // Dedupe threshold for the extractor — lower so near-duplicates surface.
    dedupeThreshold:     num(process.env.MEMORY_DEDUPE_THRESHOLD, 0.6),
    dedupeLimit:         num(process.env.MEMORY_DEDUPE_LIMIT, 10),
    // Hard cap on the formatted memory block injected into userMemory.
    promptCharBudget:    num(process.env.MEMORY_PROMPT_CHAR_BUDGET, 800),
    // Extractor LLM tunables.
    extractTimeoutMs:    num(process.env.MEMORY_EXTRACT_TIMEOUT_MS, 20_000),
    extractMaxTokens:    num(process.env.MEMORY_EXTRACT_MAX_TOKENS, 600),
  },
} as const;

export type AgentType = "stock" | "general" | "brief";
