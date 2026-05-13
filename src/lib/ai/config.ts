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
} as const;

export type AgentType = "stock" | "general" | "brief";
