// Deterministic tests for formatMemoriesForPrompt — no LLM, no network.
// Other paths in memory.ts (searchMemories, addMemories) call out to Mistral
// and Supabase; covered by e2e smoke instead.

import { formatMemoriesForPrompt } from "@/lib/ai/memory";
import type { AiMemoryMatch } from "@/types/database";

function row(memory: string, similarity = 0.9): AiMemoryMatch {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    memory,
    category: "preference",
    metadata: {},
    similarity,
    created_at: "2026-05-16T00:00:00Z",
    updated_at: "2026-05-16T00:00:00Z",
  };
}

describe("formatMemoriesForPrompt", () => {
  it("returns empty string when no rows", () => {
    expect(formatMemoriesForPrompt([])).toBe("");
    expect(formatMemoriesForPrompt(null as unknown as AiMemoryMatch[])).toBe("");
  });

  it("formats a single memory with header and footer", () => {
    const out = formatMemoriesForPrompt([row("Prefers dividend stocks")]);
    expect(out).toContain("Known facts about the user");
    expect(out).toContain("- Prefers dividend stocks");
    expect(out).toContain("Never invent or expand");
  });

  it("preserves order of input rows (caller sorts by similarity)", () => {
    const out = formatMemoriesForPrompt([
      row("Long-term investor"),
      row("Low risk tolerance"),
      row("Lives in Bangalore"),
    ]);
    const firstIdx = out.indexOf("Long-term investor");
    const lastIdx = out.indexOf("Lives in Bangalore");
    expect(firstIdx).toBeGreaterThan(0);
    expect(lastIdx).toBeGreaterThan(firstIdx);
  });

  it("truncates to the configured char budget", () => {
    const long = "x".repeat(500);
    const rows = Array.from({ length: 10 }, () => row(long));
    const out = formatMemoriesForPrompt(rows);
    // Default budget is 800.
    expect(out.length).toBeLessThanOrEqual(800);
    expect(out.endsWith("…")).toBe(true);
  });
});
