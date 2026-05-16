// Mistral embeddings helper. Wraps the mistral-embed API with a single retry.
// Used by the memory layer (src/lib/ai/memory.ts) for semantic search + storage.

const MISTRAL_EMBED_ENDPOINT = "https://api.mistral.ai/v1/embeddings";
const MISTRAL_EMBED_MODEL = "mistral-embed";
const EMBED_DIM = 1024;
const MAX_RETRIES = 1;
const DEFAULT_TIMEOUT_MS = 15_000;

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

function isRetryable(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return /timeout|timed out|network|fetch failed|429|5\d\d|ECONN|ENOTFOUND/i.test(raw);
}

/**
 * Embed a single string with mistral-embed. Returns a 1024-dim vector.
 * Throws on auth failure or after the retry budget. Caller is responsible for
 * catching when this is on a non-critical path (memory search/extract).
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const trimmed = text.trim();
  if (!trimmed) throw new Error("embedText: empty input");

  // mistral-embed has an 8k token input cap; ~32k chars is a safe ceiling.
  const input = trimmed.length > 32_000 ? trimmed.slice(0, 32_000) : trimmed;

  let lastError: unknown = new Error("Unknown Mistral embed error");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(MISTRAL_EMBED_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: MISTRAL_EMBED_MODEL,
          input: [input],
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Mistral embed HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`
        );
      }

      const parsed = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const embedding = parsed.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length !== EMBED_DIM) {
        throw new Error(
          `Mistral embed: bad payload (got ${Array.isArray(embedding) ? embedding.length : "non-array"} dims, expected ${EMBED_DIM})`
        );
      }
      return embedding;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;
    }
  }

  throw lastError;
}

export const EMBEDDING_DIM = EMBED_DIM;
