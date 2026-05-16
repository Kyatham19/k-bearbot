import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyIntent, streamChat, validateAiSetup } from "@/lib/ai";
import {
  searchWeb,
  validateSerpApiSetup,
  normalizeSourceDomain,
  type WebSearchResult,
} from "@/lib/ai/web-search";
import { buildUserContext } from "@/lib/ai/user-context";
import {
  searchMemories,
  formatMemoriesForPrompt,
  addMemories,
} from "@/lib/ai/memory";
import { detectTanglish } from "@/lib/ai/lang-detect";
import {
  LANG_INSTRUCTION_TANGLISH,
  LANG_INSTRUCTION_ENGLISH,
  WEB_SEARCH_INSTRUCTION,
} from "@/lib/ai/prompts";
import { runDeepResearch, formatResearchBundle } from "@/lib/ai/deep-research";
import { resolveSymbol } from "@/lib/stock/symbols";
import { fetchQuote, fetchHistory, fetchCompanyInfo } from "@/lib/stock/data";
import { fetchStockNews } from "@/lib/stock/news";
import { analyzeTechnicals } from "@/lib/stock/technicals";
import { assessMacroRisks, assessRawMaterialRisks } from "@/lib/stock/macro";
import type { StockAnalysis } from "@/types/stock";

const EMPTY_RESPONSE_FALLBACK =
  "Unable to generate analysis right now. Showing available data below.";

const AI_PROGRESS_FRAME_PREFIX = "\u001eALPHASIGHT_PROGRESS:";
const AI_PROGRESS_FRAME_SUFFIX = "\u001e";

type AIProgressFrame = {
  type?: "progress" | "search_source" | "phase_update" | "task_complete";
  label?: string;
  progress?: number;
  status?: "active" | "complete";
  phase?: "planning" | "searching" | "analyzing" | "synthesizing" | "finalizing";
  domain?: string;
  title?: string;
  timestamp?: number;
};

const TICKER_PATTERN = /\$([A-Z]{1,10}(?:\.[A-Z]{1,2})?)\b/;
const NOUN_PHRASE_PATTERN =
  /(?:analyze|analysis\s+of|price\s+of|quote\s+for|stock\s+of)\s+([a-zA-Z0-9.&\-\s]{2,40})/i;

// Regex-only stock detection. Returns a high-confidence match (dollar ticker,
// bare all-caps ticker, or explicit "analyze X" noun phrase) or null.
// Keyword-only matches ("hold on", "what is rsi") used to trigger stock mode
// here — they're now deferred to the LLM classifier to avoid false positives.
function detectStockQuery(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const dollarMatch = trimmed.match(TICKER_PATTERN);
  if (dollarMatch?.[1]) return dollarMatch[1].toUpperCase();

  if (/^[A-Z]{1,10}(\.[A-Z]{1,2})?$/.test(trimmed)) return trimmed.toUpperCase();

  const nounPhraseMatch = trimmed.match(NOUN_PHRASE_PATTERN);
  if (nounPhraseMatch?.[1]) return nounPhraseMatch[1].trim();

  return null;
}

function isGreeting(message: string): boolean {
  const t = message.trim().toLowerCase().replace(/[!.?]+$/g, "");
  if (t.length <= 20 && /^(hi|hey|hello|yo|sup|howdy|good\s+(morning|afternoon|evening|night)|thanks|thank\s+you|ok|okay|bye)$/.test(t)) {
    return true;
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function withStreamTimeout(
  stream: ReadableStream<Uint8Array>,
  timeoutMs: number
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const result = await Promise.race<
            ReadableStreamReadResult<Uint8Array> | { timeout: true }
          >([
            reader.read(),
            new Promise<{ timeout: true }>((resolve) =>
              setTimeout(() => resolve({ timeout: true }), timeoutMs)
            ),
          ]);

          if ("timeout" in result) {
            controller.enqueue(encoder.encode(EMPTY_RESPONSE_FALLBACK));
            await reader.cancel("stream timed out");
            controller.close();
            return;
          }

          if (result.done) {
            controller.close();
            return;
          }

          if (result.value) controller.enqueue(result.value);
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function buildStockMetadata(stockAnalysis: StockAnalysis | null): Record<string, unknown> {
  if (!stockAnalysis) return {};
  return {
    stockData: [
      {
        symbol: stockAnalysis.quote.symbol,
        name: stockAnalysis.quote.name,
        price: stockAnalysis.quote.price,
        change: stockAnalysis.quote.change,
        changePercent: stockAnalysis.quote.changePercent,
        volume: stockAnalysis.quote.volume,
        marketCap: stockAnalysis.quote.marketCap,
        pe: stockAnalysis.quote.pe,
        high52: stockAnalysis.quote.high52,
        low52: stockAnalysis.quote.low52,
        dayHigh: stockAnalysis.quote.dayHigh,
        dayLow: stockAnalysis.quote.dayLow,
        open: stockAnalysis.quote.open,
        previousClose: stockAnalysis.quote.previousClose,
        currency: stockAnalysis.quote.currency,
        exchange: stockAnalysis.quote.exchange,
      },
    ],
    news: stockAnalysis.news.map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source,
      publishedAt: n.publishedAt,
      summary: n.summary,
    })),
  };
}

function compactStockAnalysis(input: StockAnalysis): StockAnalysis {
  const compactCompanyInfo = input.companyInfo
    ? {
        ...input.companyInfo,
        description: input.companyInfo.description
          ? input.companyInfo.description.slice(0, 400)
          : "",
      }
    : undefined;

  return {
    ...input,
    // Keep roughly one trading year to reduce context size and token usage.
    history: input.history.slice(-260),
    news: input.news.slice(0, 4),
    macroRisks: input.macroRisks.slice(0, 4),
    rawMaterialRisks: input.rawMaterialRisks.slice(0, 4),
    companyInfo: compactCompanyInfo,
  };
}

function hasVisibleText(value: string): boolean {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim().length > 0;
}

function encodeProgressFrame(frame: AIProgressFrame): Uint8Array {
  return new TextEncoder().encode(
    `${AI_PROGRESS_FRAME_PREFIX}${JSON.stringify(frame)}${AI_PROGRESS_FRAME_SUFFIX}`
  );
}

function chatJsonResponse(
  text: string,
  status: number,
  opts?: { error?: string; details?: string; meta?: Record<string, unknown> }
) {
  return NextResponse.json(
    {
      text: hasVisibleText(text) ? text : EMPTY_RESPONSE_FALLBACK,
      charts: [],
      meta: opts?.meta ?? {},
      ...(opts?.error ? { error: opts.error } : {}),
      ...(opts?.details ? { details: opts.details } : {}),
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    const progressEvents: AIProgressFrame[] = [];
    let hasActiveProgressTask = false;
    let lastPhase: AIProgressFrame["phase"] | null = null;
    const inferPhase = (progress: number): NonNullable<AIProgressFrame["phase"]> => {
      if (progress <= 20) return "planning";
      if (progress <= 55) return "searching";
      if (progress <= 75) return "analyzing";
      if (progress <= 92) return "synthesizing";
      return "finalizing";
    };
    const recordProgress = (label: string, progress: number) => {
      const phase = inferPhase(progress);
      if (hasActiveProgressTask) {
        progressEvents.push({ type: "task_complete" });
      }
      if (phase !== lastPhase) {
        progressEvents.push({ type: "phase_update", phase, label });
        lastPhase = phase;
      }
      progressEvents.push({ type: "progress", label, progress, status: "active" });
      hasActiveProgressTask = true;
    };

    console.debug("[chat-api] request received");
    recordProgress("Checking your session", 5);
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return chatJsonResponse("Your session expired. Please log in again.", 401, {
        error: "Unauthorized",
      });
    }

    const body = (await request.json()) as {
      message?: string;
      conversationId?: string;
      model?: "mistral";
      forceWebSearch?: boolean;
    };
    const incomingMessage = body.message?.trim() ?? "";
    const requestedConversationId = body.conversationId ?? null;
    const requestedModel: "mistral" = body.model ?? "mistral";
    const forceWebSearch = body.forceWebSearch === true;

    if (!incomingMessage) {
      return chatJsonResponse("Please enter a message.", 400, {
        error: "Message is required",
      });
    }

    if (incomingMessage.length > 4000) {
      return chatJsonResponse("Message too long. Please shorten and retry.", 400, {
        error: "Message too long (max 4000 characters)",
      });
    }
    console.debug("[chat-api] validated request", {
      userId: user.id,
      messageLength: incomingMessage.length,
      hasConversationId: Boolean(requestedConversationId),
    });

    recordProgress("Checking AI provider configuration", 8);
    const aiValidation = validateAiSetup();
    if (!aiValidation.valid) {
      return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 503, {
        error: "LLM service not configured",
        details: aiValidation.error,
      });
    }

    let activeConversationId = requestedConversationId;
    if (!activeConversationId) {
      recordProgress("Creating a new conversation", 12);
      const title =
        incomingMessage.length > 60
          ? `${incomingMessage.substring(0, 60)}...`
          : incomingMessage;
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (error || !conversation) {
        return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 500, {
          error: "Failed to create conversation",
          details: error?.message ?? "",
        });
      }
      activeConversationId = conversation.id;
    } else {
      recordProgress("Verifying conversation access", 12);
      const { data: existing, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", activeConversationId)
        .eq("user_id", user.id)
        .single();
      if (error || !existing) {
        return chatJsonResponse("Conversation not found.", 404, {
          error: "Conversation not found",
        });
      }
    }

    recordProgress("Loading conversation history and preferences", 18);
    const [historyResponse, userMemoryBase, prefsResponse, semanticMemoryRows] =
      await Promise.all([
        supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: false })
          .limit(12),
        buildUserContext(supabase, user.id).catch((err) => {
          console.warn("[chat-api] buildUserContext failed", err);
          return "";
        }),
        supabase
          .from("user_preferences")
          .select("language_mode")
          .eq("user_id", user.id)
          .maybeSingle(),
        searchMemories(supabase, user.id, incomingMessage),
      ]);

    recordProgress("Saving your message", 22);
    // Insert user message after fetching history to avoid duplicating it in the LLM context
    const { error: userMessageError } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: incomingMessage,
    });
    if (userMessageError) {
      return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 500, {
        error: "Failed to save message",
        details: userMessageError.message,
      });
    }

    // Detect and save user memory (e.g., name)
    const nameMatch = incomingMessage.match(/(?:my name is|I am|I'm|call me)\s+([a-zA-Z\s]+)/i);
    if (nameMatch) {
      recordProgress("Updating user memory", 24);
      const name = nameMatch[1].trim();
      console.log("[chat-api] Saving name:", name);
      const { error } = await supabase
        .from("user_memory")
        .upsert({ user_id: user.id, key: "name", value: name }, { onConflict: "user_id,key" });
      if (error) console.error("[chat-api] Save name error:", error);
    }

    const languageMode: "auto" | "english" | "tanglish" =
      (prefsResponse.data?.language_mode as "auto" | "english" | "tanglish") ?? "auto";

    let useTanglish = false;
    if (languageMode === "tanglish") useTanglish = true;
    else if (languageMode === "english") useTanglish = false;
    else useTanglish = detectTanglish(incomingMessage);

    const languageInstruction = useTanglish
      ? LANG_INSTRUCTION_TANGLISH
      : LANG_INSTRUCTION_ENGLISH;

    const semanticMemoryBlock = formatMemoriesForPrompt(semanticMemoryRows);
    console.debug("[chat-api] semantic memory recall", {
      hits: semanticMemoryRows.length,
      chars: semanticMemoryBlock.length,
    });

    let userMemory = [semanticMemoryBlock, userMemoryBase, languageInstruction]
      .filter((s) => s && s.length > 0)
      .join("\n\n");

    const historyRows = historyResponse.data;
    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = (
      historyRows || []
    )
      .filter((m): m is { role: "user" | "assistant"; content: string } =>
        m.role === "user" || m.role === "assistant"
      )
      .reverse()
      .map((m) => ({ role: m.role, content: m.content ?? "" }));

    let stockAnalysis: StockAnalysis | null = null;
    let llmMessage = incomingMessage;
    let chatMode: "stock" | "general" = "general";
    let generalKind: "brief" | "normal" = "normal";

    recordProgress("Detecting whether this is a stock or general query", 28);
    // Intent pipeline:
    // 1. Regex (high-confidence stock signals) → stock mode candidate
    // 2. Classifier LLM fallback → stock / greeting / general
    let stockQuery: string | null = detectStockQuery(incomingMessage);
    console.debug("[chat-api] regex detection", { stockQuery: stockQuery ?? null });

    // Skip classifier for short lowercase general questions — saves quota.
    const looksLikeGeneral =
      incomingMessage.length < 60 &&
      !/[A-Z]{2,}/.test(incomingMessage) &&
      !/\b(stock|share|ticker|price|quote|analyze|analysis|chart|buy|sell)\b/i.test(
        incomingMessage
      );

    if (!stockQuery) {
      if (isGreeting(incomingMessage)) {
        generalKind = "normal";
        console.debug("[chat-api] greeting shortcut");
      } else if (looksLikeGeneral) {
        console.debug("[chat-api] general shortcut (skip classifier)");
      } else {
        try {
          recordProgress("Classifying request intent", 31);
          const intent = await withTimeout(
            classifyIntent(incomingMessage),
            3000,
            "classifyIntent"
          );
          console.debug("[chat-api] classifier result", intent ?? null);
          if (intent) {
            if (intent.intent === "stock_query" || intent.intent === "comparison") {
              stockQuery =
                intent.company_name ||
                (intent.symbols && intent.symbols[0]) ||
                incomingMessage;
            } else if (intent.intent === "greeting") {
              generalKind = "brief";
            }
          }
        } catch (error) {
          console.warn("[chat-api] classifier failed", error instanceof Error ? error.message : error);
        }
      }
    }

    if (stockQuery) {
      recordProgress(`Resolving ticker for "${stockQuery}"`, 35);
      const resolvedSymbol = await withTimeout(resolveSymbol(stockQuery), 8000, "resolveSymbol");
      console.debug("[chat-api] symbol resolution", {
        query: stockQuery,
        symbol: resolvedSymbol ?? null,
      });
      if (!resolvedSymbol) {
        // Classifier or regex thought this was a stock, but we couldn't
        // resolve a ticker. Answer in general mode with a short note instead
        // of forcing the 8-section stock prompt.
        llmMessage = `${incomingMessage}\n\n(Context note for the assistant: I tried to look up live market data for "${stockQuery}" but no matching ticker was found. Answer the user's question helpfully without pretending to have real-time prices.)`;
      }
      if (resolvedSymbol) {
        try {
          recordProgress(`Fetching live quote for ${resolvedSymbol}`, 42);
          const quote = await withTimeout(fetchQuote(resolvedSymbol), 10000, "fetchQuote");
          if (!quote) throw new Error("Quote not found");

          // Detect if this is a simple query (price, quote, etc.) to skip heavy data fetching
          const isSimpleQuery = /\b(price|quote|current|worth|cost|value|trading\s+at)\b/i.test(incomingMessage) &&
                                !/\b(analyze|analysis|technical|fundamental|news|sentiment|recommend|buy|sell|invest)\b/i.test(incomingMessage);

          if (isSimpleQuery) {
            console.debug("[chat-api] simple stock query detected, skipping heavy data");
            recordProgress(`Preparing quote snapshot for ${resolvedSymbol}`, 50);
            // For simple queries, just get quote and minimal data
            stockAnalysis = compactStockAnalysis({
              quote,
              history: [], // Skip history for simple queries
              technicals: {
                sma20: null,
                sma50: null,
                ema20: null,
                rsi: null,
                macd: { macdLine: null, signalLine: null, histogram: null },
                supportLevels: [],
                resistanceLevels: [],
                breakoutZones: [],
                trend: "neutral"
              },
              news: [], // Skip news for simple queries
              macroRisks: [],
              rawMaterialRisks: [],
              companyInfo: {
                sector: "Unknown",
                industry: "Unknown",
                description: "",
                employees: null,
                website: "",
                country: "",
              },
            });
            chatMode = "stock";
            console.debug("[chat-api] simple stock analysis ready", { symbol: resolvedSymbol });
          } else {
            // Full analysis for complex queries
            recordProgress(`Fetching history, company profile, and news for ${resolvedSymbol}`, 50);
            const [historyResult, companyInfoResult, newsResult] = await Promise.allSettled([
              withTimeout(fetchHistory(resolvedSymbol, 1), 10000, "fetchHistory"), // Faster timeout
              withTimeout(fetchCompanyInfo(resolvedSymbol), 10000, "fetchCompanyInfo"), // Faster timeout
              withTimeout(fetchStockNews(resolvedSymbol), 10000, "fetchStockNews"), // Faster timeout
            ]);

            const history = historyResult.status === "fulfilled" ? historyResult.value : [];
            const companyInfo =
              companyInfoResult.status === "fulfilled"
                ? companyInfoResult.value
                : {
                    sector: "Unknown",
                    industry: "Unknown",
                    description: "",
                    employees: null,
                    website: "",
                    country: "",
                  };
            const news = newsResult.status === "fulfilled" ? newsResult.value : [];

            recordProgress(`Calculating technical indicators for ${resolvedSymbol}`, 58);
            stockAnalysis = compactStockAnalysis({
              quote,
              history,
              technicals: analyzeTechnicals(history, quote.price),
              news,
              macroRisks: assessMacroRisks(resolvedSymbol, companyInfo.sector, companyInfo.country),
              rawMaterialRisks: assessRawMaterialRisks(resolvedSymbol, companyInfo.sector),
              companyInfo,
            });
            chatMode = "stock";
            console.debug("[chat-api] full stock analysis ready", {
              symbol: resolvedSymbol,
              historyPoints: history.length,
              newsCount: news.length,
            });
          }
        } catch (stockError) {
          console.error("[chat-api] stock enrichment failed", stockError);
          llmMessage = `${incomingMessage}\n\nNote: Live stock lookup for "${resolvedSymbol}" failed (${stockError instanceof Error ? stockError.message : String(stockError)}). Explain this briefly, then continue with a useful text-only analysis.`;
        }
      }
    }

    // Web search trigger: broadened auto-keywords + manual force flag + stock-mode news intent
    const autoKeywords =
      /\b(current|latest|news|update|recent|today|now|yesterday|this\s+week|this\s+month|what\s+is|who\s+is|where\s+is|when\s+did|why\s+did|how\s+to|explain|tell\s+me\s+about|compare|vs|versus|alternatives\s+to|review\s+of|opinion\s+on)\b/i;
    const stockNewsIntent =
      chatMode === "stock" && /\b(news|recent|today|latest|update)\b/i.test(incomingMessage);
    const shouldSearch =
      validateSerpApiSetup().valid &&
      (forceWebSearch || autoKeywords.test(incomingMessage) || stockNewsIntent);

    let webSearch: WebSearchResult | null = null;
    if (shouldSearch) {
      try {
        recordProgress(forceWebSearch ? "Running requested web search" : "Searching recent web/news sources", 64);
        webSearch = await searchWeb(incomingMessage, 5);
        const emittedDomains = new Set<string>();
        for (const source of webSearch.sources) {
          const domain = normalizeSourceDomain(source.url);
          if (!domain || emittedDomains.has(domain)) continue;
          emittedDomains.add(domain);
          progressEvents.push({
            type: "search_source",
            domain,
            title: source.title,
            timestamp: source.publishedAt ? Date.parse(source.publishedAt) || Date.now() : Date.now(),
          });
        }
        console.debug("[chat-api] web search complete", {
          query: incomingMessage.slice(0, 80),
          sourceCount: webSearch.sources.length,
          forced: forceWebSearch,
        });
      } catch (error) {
        console.warn("[chat-api] Web search failed:", error);
      }
    }

    if (webSearch && webSearch.sources.length > 0) {
      userMemory += `\n\n${WEB_SEARCH_INSTRUCTION}\n\n${webSearch.formattedForPrompt}`;
    }

    // Deep research pass for full stock analyses (skipped for simple price-only queries)
    if (chatMode === "stock" && stockAnalysis && stockAnalysis.history.length > 0) {
      try {
        recordProgress("Running deep research: peers, sector, inputs, macro", 72);
        const research = await withTimeout(runDeepResearch(stockAnalysis), 8000, "deepResearch");
        userMemory += `\n\n${formatResearchBundle(research)}`;
        console.debug("[chat-api] deep research attached", {
          companyNews: research.companyNews.length,
          sectorNews: research.sectorNews.length,
          commodityNews: research.commodityNews.length,
          geoNews: research.geoNews.length,
          peers: research.peers.length,
        });
      } catch (err) {
        console.warn("[chat-api] deep research failed (skipping):", err);
      }
    }

    const conversationId = activeConversationId as string;

    let llmStream: ReadableStream<Uint8Array>;
    let usedProvider = "unknown";
    try {
      recordProgress(`Opening ${chatMode === "stock" ? "stock analysis" : "general chat"} LLM stream`, 80);
      console.debug("[chat-api] opening LLM stream", { mode: chatMode });
      const result = await withTimeout(
        streamChat({
          mode: chatMode,
          message: llmMessage,
          history: conversationHistory,
          analysis: stockAnalysis ?? undefined,
          kind: generalKind,
          model: requestedModel,
          userMemory: userMemory || undefined,
        }),
        90_000,
        "streamChat"
      );
      llmStream = result.stream;
      usedProvider = result.provider;
    } catch (llmError) {
      console.error("CHAT ERROR:", llmError);
      const encoder = new TextEncoder();
      llmStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(EMPTY_RESPONSE_FALLBACK));
          controller.close();
        },
      });
    }

    const timedStream = withStreamTimeout(llmStream, 60_000);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    let persisted = false;

    const persistAssistantMessage = async () => {
      if (persisted) return;
      persisted = true;

      let fullResponse = chunks.join("");
      if (!hasVisibleText(fullResponse)) {
        fullResponse = EMPTY_RESPONSE_FALLBACK;
      }
      console.debug("[chat-api] persisting assistant response", {
        conversationId,
        chars: fullResponse.length,
        visible: hasVisibleText(fullResponse),
      });

      const metadata = buildStockMetadata(stockAnalysis);
      metadata.provider = usedProvider;
      if (webSearch && webSearch.sources.length > 0) {
        metadata.sources = webSearch.sources;
      }

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: fullResponse,
        metadata: metadata,
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      // Extract durable user facts from this turn into the semantic memory
      // store. Uses next/server `after()` so the work keeps running on
      // Vercel serverless after the response is sent (Next.js 15.1+).
      // Failures are logged inside addMemories() — never throws.
      after(
        addMemories(supabase, user.id, {
          userMessage: incomingMessage,
          assistantResponse: fullResponse,
          conversationId,
        })
      );
    };

    const outboundStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const event of progressEvents) {
          controller.enqueue(encodeProgressFrame(event));
        }
        controller.enqueue(encodeProgressFrame({ type: "task_complete" }));
        controller.enqueue(
          encodeProgressFrame({
            type: "phase_update",
            phase: "synthesizing",
            label: "Streaming response from the LLM",
          })
        );
        controller.enqueue(
          encodeProgressFrame({
            type: "progress",
            label: "Streaming response from the LLM",
            progress: 88,
            status: "active",
          })
        );

        const reader = timedStream.getReader();
        let chunkCount = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            const text = decoder.decode(value, { stream: true });
            if (text) {
              chunks.push(text);
              chunkCount++;
            }
            controller.enqueue(value);
          }
        } catch {
          // Stream failure falls back below.
        } finally {
          reader.releaseLock();
          if (!hasVisibleText(chunks.join(""))) {
            chunks.push(EMPTY_RESPONSE_FALLBACK);
            controller.enqueue(encoder.encode(EMPTY_RESPONSE_FALLBACK));
          }
          controller.enqueue(
            encodeProgressFrame({
              type: "task_complete",
            })
          );
          controller.enqueue(
            encodeProgressFrame({
              type: "phase_update",
              phase: "finalizing",
              label: "Saving assistant response",
            })
          );
          controller.enqueue(
            encodeProgressFrame({
              type: "progress",
              label: "Saving assistant response",
              progress: 96,
              status: "active",
            })
          );
          await persistAssistantMessage();
          controller.enqueue(
            encodeProgressFrame({
              type: "task_complete",
            })
          );
          controller.enqueue(
            encodeProgressFrame({
              type: "progress",
              progress: 100,
              status: "complete",
            })
          );
          controller.close();
          console.debug("[chat-api] stream finished", {
            conversationId,
            chunks: chunkCount,
            totalChars: chunks.join("").length,
          });
        }
      },
      cancel() {
        persistAssistantMessage().catch((error) => console.error("CHAT ERROR:", error));
      },
    });

    const hasWebSources = Boolean(webSearch && webSearch.sources.length > 0);
    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Conversation-Id": conversationId,
      "X-Has-Stock-Data": stockAnalysis ? "true" : "false",
      "X-Has-Web-Sources": hasWebSources ? "true" : "false",
      "Access-Control-Expose-Headers":
        "X-Conversation-Id, X-Has-Stock-Data, X-Stock-Symbol, X-Stock-Exchange, X-Has-Web-Sources",
    };
    if (stockAnalysis) {
      responseHeaders["X-Stock-Symbol"] = stockAnalysis.quote.symbol;
      responseHeaders["X-Stock-Exchange"] = stockAnalysis.quote.exchange || "";
    }

    return new Response(outboundStream, { headers: responseHeaders });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    const details = error instanceof Error ? error.message : String(error);
    return chatJsonResponse(EMPTY_RESPONSE_FALLBACK, 500, {
      error: "Internal error",
      details,
    });
  }
}
