// Semantic memory layer (mem0-style) for AlphaSight AI chat.
//
// Two paths:
//   - searchMemories(): retrieve top-K facts about the user, semantically
//     similar to the latest message. Called before the LLM stream opens.
//   - addMemories(): non-blocking post-stream extraction. Asks a small LLM to
//     decide ADD/UPDATE/SKIP relative to existing nearby memories, then writes
//     back via pgvector. Wrapped in try/catch — never throws.
//
// Both paths are best-effort. Failures are logged and swallowed so chat is
// never blocked by memory operations.

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "./embeddings";
import { AGENT_CONFIG } from "./config";
import type { AiMemoryMatch } from "@/types/database";

const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const EXTRACT_MODEL = "mistral-small-latest";

export interface SearchMemoriesOptions {
  limit?: number;
  threshold?: number;
}

export interface AddMemoriesInput {
  userMessage: string;
  assistantResponse: string;
  conversationId: string;
}

interface ExtractOperation {
  action: "ADD" | "UPDATE" | "SKIP";
  id?: string;
  memory?: string;
  category?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Search
// ────────────────────────────────────────────────────────────────────────

/**
 * Retrieve the top-K semantic memories for a user given a query string.
 * Returns [] on any failure (embedding error, RPC error, etc.) — semantic
 * recall is non-critical and must never break chat.
 */
// Messages that are too short or are pure greetings/acks aren't worth a
// Mistral embed call — they won't match anything meaningful and they burn
// quota + p50 latency on every "hi" / "ok" / "thanks".
const TRIVIAL_PATTERN =
  /^(hi|hey|hello|yo|sup|howdy|ok|okay|kk|k|thanks|thank\s*you|ty|bye|good\s+(morning|afternoon|evening|night))[!.?\s]*$/i;

function isTrivialMessage(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return true;
  return TRIVIAL_PATTERN.test(t);
}

export async function searchMemories(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts: SearchMemoriesOptions = {}
): Promise<AiMemoryMatch[]> {
  const trimmed = query.trim();
  if (!trimmed || !userId) return [];
  if (isTrivialMessage(trimmed)) return [];

  const limit = opts.limit ?? AGENT_CONFIG.memory.searchLimit;
  const threshold = opts.threshold ?? AGENT_CONFIG.memory.similarityThreshold;

  try {
    const embedding = await embedText(trimmed);
    const { data, error } = await supabase.rpc("match_ai_memories", {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: limit,
      similarity_threshold: threshold,
    });
    if (error) {
      console.warn("[memory] match_ai_memories failed:", error.message);
      return [];
    }
    return (data ?? []) as AiMemoryMatch[];
  } catch (err) {
    console.warn(
      "[memory] searchMemories failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Format retrieved memories into a human-readable block for the system prompt.
 * Returns "" when there are no rows. Truncated to the configured char budget
 * so we stay inside the existing 1200-char userMemory cap alongside structured
 * context.
 */
export function formatMemoriesForPrompt(rows: AiMemoryMatch[]): string {
  if (!rows || rows.length === 0) return "";

  // Already returned sorted by distance ascending (= similarity desc).
  const lines = rows.map((r) => `- ${r.memory}`);
  const header = "Known facts about the user (from past chats):";
  const body = lines.join("\n");
  const footer = "Use these naturally when relevant. Never invent or expand.";
  let block = `${header}\n${body}\n${footer}`;

  const budget = AGENT_CONFIG.memory.promptCharBudget;
  if (block.length > budget) {
    block = block.slice(0, budget - 1) + "…";
  }
  return block;
}

// ────────────────────────────────────────────────────────────────────────
// Extraction / write
// ────────────────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM_PROMPT = `You extract durable user facts from a single chat turn for a personal finance assistant.

Rules:
- Only extract facts the user explicitly stated about THEMSELVES: preferences, holdings intent, risk tolerance, personal details, goals, constraints.
- NEVER extract market data, stock prices, news, transient context, or things the assistant said unless the user confirmed them.
- Compare each candidate fact to existing memories. If it contradicts an existing memory, UPDATE the existing memory by id. If it's already covered or redundant, SKIP.
- If the turn contains nothing memory-worthy, return an empty operations array.
- Memories should be short, third-person, self-contained sentences (e.g. "Prefers dividend stocks", "Lives in Bangalore", "Has low risk tolerance").
- Use one-word categories: preference, risk_profile, holding_intent, personal, goal, constraint.

Output JSON only, no prose, no code fences. Schema:
{"operations":[{"action":"ADD","memory":"...","category":"..."}, {"action":"UPDATE","id":"<existing-uuid>","memory":"...","category":"..."}, {"action":"SKIP"}]}`;

function buildExtractUserPrompt(
  input: AddMemoriesInput,
  existing: AiMemoryMatch[]
): string {
  const existingBlock = existing.length
    ? existing.map((m) => `- [${m.id}] (${m.category ?? "n/a"}) ${m.memory}`).join("\n")
    : "(none)";

  const assistantTrimmed =
    input.assistantResponse.length > 500
      ? input.assistantResponse.slice(0, 500) + "…"
      : input.assistantResponse;

  return `Existing memories:
${existingBlock}

New turn:
User: ${input.userMessage}
Assistant: ${assistantTrimmed}`;
}

function readApiKey(): string {
  const raw = process.env.MISTRAL_API_KEY?.trim() ?? "";
  if (!raw) return "";
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

// JSON schema for the extractor — strict mode locks the model to this shape.
// More reliable than json_object on mistral-small-latest (Mistral testing
// shows 100% vs 64% conformance for complex shapes).
const EXTRACT_JSON_SCHEMA = {
  name: "memory_operations",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["operations"],
    properties: {
      operations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action"],
          properties: {
            action: { type: "string", enum: ["ADD", "UPDATE", "SKIP"] },
            id: { type: "string" },
            memory: { type: "string" },
            category: { type: "string" },
          },
        },
      },
    },
  },
} as const;

async function callExtractor(
  userPrompt: string
): Promise<ExtractOperation[]> {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const basePayload = {
    model: EXTRACT_MODEL,
    messages: [
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: AGENT_CONFIG.memory.extractMaxTokens,
    stream: false,
  };

  // Try strict json_schema mode first; degrade to json_object then no
  // response_format on 400-class errors (older Mistral revs / quota mismatch).
  const attempts: Array<Record<string, unknown>> = [
    { ...basePayload, response_format: { type: "json_schema", json_schema: EXTRACT_JSON_SCHEMA } },
    { ...basePayload, response_format: { type: "json_object" } },
    { ...basePayload },
  ];

  let lastError: unknown = new Error("extractor: no attempt ran");
  for (const payload of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      AGENT_CONFIG.memory.extractTimeoutMs
    );
    try {
      const response = await fetch(MISTRAL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const err = new Error(
          `Mistral extract HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`
        );
        // Only retry on 400 (likely response_format incompatibility). 401/403/429/5xx → bail.
        if (response.status === 400) {
          lastError = err;
          continue;
        }
        throw err;
      }

      const parsed = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = parsed.choices?.[0]?.message?.content ?? "";
      return parseOperations(content);
    } catch (err) {
      lastError = err;
      // AbortError or non-400 HTTP — stop retrying.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/HTTP 400/.test(msg)) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function parseOperations(raw: string): ExtractOperation[] {
  if (!raw) return [];
  // Strip code fences if the model added them despite json_object mode.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { operations?: unknown };
    const ops = Array.isArray(parsed.operations) ? parsed.operations : [];
    return ops
      .filter((o): o is ExtractOperation => {
        if (!o || typeof o !== "object") return false;
        const action = (o as { action?: unknown }).action;
        return action === "ADD" || action === "UPDATE" || action === "SKIP";
      })
      .map((o) => ({
        action: o.action,
        id: typeof o.id === "string" ? o.id : undefined,
        memory: typeof o.memory === "string" ? o.memory.trim() : undefined,
        category: typeof o.category === "string" ? o.category.trim() : undefined,
      }));
  } catch (err) {
    console.warn(
      "[memory] failed to parse extractor JSON:",
      err instanceof Error ? err.message : err,
      "raw=",
      cleaned.slice(0, 200)
    );
    return [];
  }
}

// DB has CHECK constraints (memory 1..500, category 1..32). Clamp app-side
// too so we never round-trip just to get rejected.
const MEMORY_MAX_CHARS = 500;
const CATEGORY_MAX_CHARS = 32;

function clampMemory(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  return t.length > MEMORY_MAX_CHARS ? t.slice(0, MEMORY_MAX_CHARS) : t;
}

function clampCategory(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!t) return null;
  return t.length > CATEGORY_MAX_CHARS ? t.slice(0, CATEGORY_MAX_CHARS) : t;
}

/**
 * Post-stream: extract memory operations from the latest turn and apply them.
 * Best-effort, never throws. Call without awaiting from the chat route.
 */
export async function addMemories(
  supabase: SupabaseClient,
  userId: string,
  input: AddMemoriesInput
): Promise<void> {
  try {
    const userMsg = input.userMessage.trim();
    if (!userMsg || !userId) return;
    if (isTrivialMessage(userMsg)) return;

    // Find similar existing memories for dedupe context.
    const existing = await searchMemories(supabase, userId, userMsg, {
      limit: AGENT_CONFIG.memory.dedupeLimit,
      threshold: AGENT_CONFIG.memory.dedupeThreshold,
    });

    const userPrompt = buildExtractUserPrompt(input, existing);
    const operations = await callExtractor(userPrompt);
    if (operations.length === 0) return;

    // Per-turn dedupe: extractor occasionally emits two ADDs with the same
    // text. Collapse them so we never insert duplicates from one turn.
    const seenAddText = new Set<string>();
    const seenUpdateId = new Set<string>();

    for (const op of operations) {
      if (op.action === "SKIP") continue;

      if (op.action === "ADD") {
        if (!op.memory) continue;
        const memText = clampMemory(op.memory);
        const cat = clampCategory(op.category);
        const key = memText.toLowerCase();
        if (seenAddText.has(key)) continue;
        seenAddText.add(key);

        try {
          const embedding = await embedText(memText);
          const { error } = await supabase.from("ai_memories").insert({
            user_id: userId,
            memory: memText,
            embedding: embedding as unknown as number[],
            category: cat,
            metadata: { conversation_id: input.conversationId },
          });
          if (error) {
            console.warn("[memory] ADD insert failed:", error.message);
          }
        } catch (err) {
          console.warn(
            "[memory] ADD failed:",
            err instanceof Error ? err.message : err
          );
        }
        continue;
      }

      if (op.action === "UPDATE") {
        if (!op.id || !op.memory) continue;
        if (seenUpdateId.has(op.id)) continue;
        seenUpdateId.add(op.id);

        const memText = clampMemory(op.memory);
        const cat = clampCategory(op.category);

        try {
          const embedding = await embedText(memText);
          const { error } = await supabase
            .from("ai_memories")
            .update({
              memory: memText,
              embedding: embedding as unknown as number[],
              category: cat,
            })
            .eq("id", op.id)
            .eq("user_id", userId);
          if (error) {
            console.warn("[memory] UPDATE failed:", error.message);
          }
        } catch (err) {
          console.warn(
            "[memory] UPDATE failed:",
            err instanceof Error ? err.message : err
          );
        }
      }
    }
  } catch (err) {
    console.warn(
      "[memory] addMemories failed:",
      err instanceof Error ? err.message : err
    );
  }
}
