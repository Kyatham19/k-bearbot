import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchQuote } from "@/lib/stock/data";
import { assessMacroRisks } from "@/lib/stock/macro";
import { fetchStockNews } from "@/lib/stock/news";
import { generateDailyBrief } from "@/lib/ai";
import { generateExcelReport } from "@/lib/excel-generator";
import { sendDailyBriefEmail } from "@/lib/email-sender";
import type { PortfolioSnapshot, PortfolioSnapshotItem } from "@/types/stock";
import type { ExcelStockData } from "@/lib/excel-generator";
// Types

// Note: Removed shouldSendBrief function as we now use UTC-based scheduling

/**
 * Generate Excel data for stocks
 */
async function generateStockExcelData(stocks: string[], aiInsights: string[]): Promise<ExcelStockData[]> {
  const excelData: ExcelStockData[] = [];

  for (let i = 0; i < stocks.length; i++) {
    const symbol = stocks[i];
    const aiInsight = aiInsights[i] || 'No insight available';

    try {
      const quote = await fetchQuote(symbol);
      if (!quote) {
        // Fallback data if quote fails
        excelData.push({
          Company: symbol,
          'Open Price': 0,
          'Close Price': 0,
          'High': 0,
          'Low': 0,
          Trend: 'Bearish' as const,
          'AI Insight': aiInsight
        });
        continue;
      }

      const trend = quote.price > quote.open ? 'Bullish' : 'Bearish';

      excelData.push({
        Company: quote.name || symbol,
        'Open Price': quote.open,
        'Close Price': quote.price,
        'High': quote.dayHigh,
        'Low': quote.dayLow,
        Trend: trend as 'Bullish' | 'Bearish',
        'AI Insight': aiInsight
      });
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      // Still add with available data
      excelData.push({
        Company: symbol,
        'Open Price': 0,
        'Close Price': 0,
        'High': 0,
        'Low': 0,
        Trend: 'Bearish' as const,
        'AI Insight': aiInsight
      });
    }
  }

  return excelData;
}

/**
 * GET /api/daily-brief - Fetch the latest daily brief for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: briefs, error } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch briefs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ briefs: briefs || [] });
  } catch (error) {
    console.error("GET /api/daily-brief error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Build a portfolio snapshot with current prices and P&L for a set of holdings.
 */
async function buildPortfolioSnapshot(
  holdings: Array<{
    symbol: string;
    quantity: number;
    avg_buy_price: number;
  }>
): Promise<PortfolioSnapshot> {
  const items: PortfolioSnapshotItem[] = await Promise.all(
    holdings.map(async (h) => {
      let currentPrice = 0;
      try {
        const quote = await fetchQuote(h.symbol);
        currentPrice = quote?.price ?? 0;
      } catch {
        // Quote fetch failed
      }

      const currentValue = currentPrice * h.quantity;
      const investedValue = h.avg_buy_price * h.quantity;
      const pnl = currentValue - investedValue;
      const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

      return {
        symbol: h.symbol,
        quantity: h.quantity,
        avgBuyPrice: h.avg_buy_price,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
      };
    })
  );

  const totalValue = items.reduce((sum, i) => sum + i.currentValue, 0);
  const totalInvested = items.reduce(
    (sum, i) => sum + i.avgBuyPrice * i.quantity,
    0
  );
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent =
    totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return {
    holdings: items,
    totalValue,
    totalPnl,
    totalPnlPercent,
  };
}

/**
 * Generate a brief for a single user.
 */
async function generateBriefForUser(
  userId: string,
  holdings: Array<{ symbol: string; quantity: number; avg_buy_price: number }>
): Promise<{
  content: string;
  snapshot: PortfolioSnapshot;
} | null> {
  if (holdings.length === 0) return null;

  const snapshot = await buildPortfolioSnapshot(holdings);

  // Fetch market indices
  const indices = ['^GSPC', '^IXIC', '^DJI'];
  const marketIndices: Array<{ symbol: string; price: number; change: number; changePercent: number }> = [];
  for (const symbol of indices) {
    try {
      const quote = await fetchQuote(symbol);
      if (quote) {
        marketIndices.push({
          symbol: quote.symbol === '^GSPC' ? 'S&P 500' : quote.symbol === '^IXIC' ? 'NASDAQ' : 'Dow Jones',
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        });
      }
    } catch {
      // Skip failed indices
    }
  }
  snapshot.marketIndices = marketIndices;

  // Sort by P&L for top movers
  const sorted = [...snapshot.holdings].sort(
    (a, b) => Math.abs(b.pnlPercent) - Math.abs(a.pnlPercent)
  );
  const topGainers = sorted
    .filter((h) => h.pnlPercent > 0)
    .slice(0, 3);
  const topLosers = sorted
    .filter((h) => h.pnlPercent < 0)
    .slice(0, 3);

  const macroRisks = assessMacroRisks(
    "SPY",
    "financial services",
    "United States"
  );

  // Fetch market indices
  const marketSymbols = ['^GSPC', '^IXIC', '^DJI']; // S&P 500, NASDAQ, Dow Jones
  const indexData: Array<{ symbol: string; price: number; change: number; changePercent: number }> = [];
  for (const symbol of marketSymbols) {
    try {
      const quote = await fetchQuote(symbol);
      if (quote) {
        indexData.push({
          symbol: quote.symbol === '^GSPC' ? 'S&P 500' : quote.symbol === '^IXIC' ? 'NASDAQ' : 'Dow Jones',
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        });
      }
    } catch {
      // Skip failed indices
    }
  }

  // Fetch recent market news
  let marketNews = '';
  try {
    const news = await fetchStockNews('market', 'global market', []);
    if (news.length > 0) {
      marketNews = news.slice(0, 3).map(n => `- ${n.title} (${n.source})`).join('\n');
    }
  } catch {
    marketNews = 'Market news unavailable';
  }

  // Build comprehensive prompt for AI
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  let prompt = `Generate a professional-grade daily portfolio brief for the user as of ${currentDate} at ${currentTime}.\n\n`;
  prompt += `Include relevant dates and timestamps in the analysis where appropriate for real-time context.\n\n`;

  prompt += `## Portfolio Data\n`;
  prompt += `- Total Value: ₹${snapshot.totalValue.toFixed(2)}\n`;
  prompt += `- Total P&L: ₹${snapshot.totalPnl.toFixed(2)} (${snapshot.totalPnlPercent.toFixed(2)}%)\n`;
  prompt += `- Number of Holdings: ${snapshot.holdings.length}\n\n`;

  if (topGainers.length > 0) {
    prompt += `## Top Gainers\n`;
    for (const g of topGainers) {
      prompt += `- ${g.symbol}: Current ₹${g.currentPrice.toFixed(2)}, P&L ${g.pnlPercent >= 0 ? "+" : ""}${g.pnlPercent.toFixed(2)}%\n`;
    }
    prompt += "\n";
  }

  if (topLosers.length > 0) {
    prompt += `## Top Losers\n`;
    for (const l of topLosers) {
      prompt += `- ${l.symbol}: Current $${l.currentPrice.toFixed(2)}, P&L ${l.pnlPercent.toFixed(2)}%\n`;
    }
    prompt += "\n";
  }

  prompt += `## Detailed Holdings\n`;
  for (const h of snapshot.holdings) {
    prompt += `- ${h.symbol}: ${h.quantity} shares @ avg $${h.avgBuyPrice.toFixed(2)}, current $${h.currentPrice.toFixed(2)}, P&L $${h.pnl.toFixed(2)} (${h.pnlPercent.toFixed(2)}%)\n`;
  }
  prompt += "\n";

  prompt += `## Market Indices\n`;
  for (const idx of indexData) {
    prompt += `- ${idx.symbol}: $${idx.price.toFixed(2)} (${idx.change >= 0 ? "+" : ""}$${idx.change.toFixed(2)}, ${idx.changePercent >= 0 ? "+" : ""}${idx.changePercent.toFixed(2)}%)\n`;
  }
  prompt += "\n";

  prompt += `## Recent Market News\n`;
  prompt += `${marketNews}\n\n`;

  prompt += `## Macro Risks\n`;
  for (const risk of macroRisks) {
    prompt += `- ${risk}\n`;
  }

  const content = await generateDailyBrief(prompt);

  return { content, snapshot };
}

/**
 * POST /api/daily-brief - Generate a new daily brief.
 * Can be triggered by:
 *   1. Authenticated user (generates for their portfolio)
 *   2. Cron job with CRON_SECRET header (generates for all users with portfolios)
 */
export async function POST(request: NextRequest) {
  try {
    // Support both Vercel cron (Authorization: Bearer <CRON_SECRET>) and custom header
    const cronSecret = request.headers.get("x-cron-secret");
    const authHeader = request.headers.get("authorization");
    const vercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isCronJob =
      vercelCron || (cronSecret && cronSecret === process.env.CRON_SECRET);

    if (isCronJob) {
      // Admin mode: process scheduled reports
      const adminSupabase = createAdminClient();

      // Get all active scheduled reports
      const { data: schedules, error: schedulesError } = await adminSupabase
        .from("scheduled_reports")
        .select("id, user_id, email, stocks, schedule_time, timezone, is_active, last_sent_at")
        .eq("is_active", true);

      if (schedulesError || !schedules) {
        console.error("scheduled_reports select error:", schedulesError);
        return NextResponse.json(
          { error: "Failed to fetch scheduled reports" },
          { status: 500 }
        );
      }

      let processed = 0;
      let sent = 0;
      let failed = 0;

      // Process each scheduled report
      for (const schedule of schedules) {
        try {
          // Since cron runs at 6 AM UTC daily, check if this user's schedule matches
          // The schedule_time is in their local timezone, so we need to check if
          // their scheduled time corresponds to approximately now (6 AM UTC)
          const now = new Date();
          const userTime = new Date(now.toLocaleString("en-US", { timeZone: schedule.timezone }));

          // Extract scheduled hour and minute
          const [scheduledHour, scheduledMinute] = schedule.schedule_time.split(':').map(Number);
          const userScheduledTime = new Date(userTime);
          userScheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0);

          // Check if current UTC time is within 30 minutes of when this user's schedule should run
          const timeDiff = Math.abs(now.getTime() - userScheduledTime.getTime());
          const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

          if (timeDiff > thirtyMinutes) {
            continue; // Not time for this user yet
          }

          // Dedup: skip if we already sent within the last 23 hours
          if (schedule.last_sent_at) {
            const lastSentMs = new Date(schedule.last_sent_at).getTime();
            const twentyThreeHours = 23 * 60 * 60 * 1000;
            if (now.getTime() - lastSentMs < twentyThreeHours) {
              continue;
            }
          }

          processed++;

          // Generate AI insights for all stocks in one call
          const stockSymbols = schedule.stocks;
          let aiSummary = '';
          let aiInsights: string[] = [];

          try {
            // Create a prompt for batch analysis
            const prompt = `Generate a daily stock market summary and individual insights for these stocks: ${stockSymbols.join(', ')}.

Provide:
1. A short overall market summary (2-3 sentences)
2. Individual insights for each stock (one sentence each)

Format as:
SUMMARY: [your summary]

${stockSymbols.map((symbol: string, index: number) => `${symbol}: [insight for ${symbol}]`).join('\n')}`;

            const aiResponse = await generateDailyBrief(prompt);
            if (aiResponse) {
              // Parse the AI response
              const lines = aiResponse.split('\n');
              const summaryLine = lines.find(line => line.startsWith('SUMMARY:'));
              aiSummary = summaryLine ? summaryLine.replace('SUMMARY:', '').trim() : 'Market summary unavailable.';

              // Extract individual insights
              aiInsights = stockSymbols.map((symbol: string) => {
                const insightLine = lines.find((line: string) => line.startsWith(`${symbol}:`));
                return insightLine ? insightLine.replace(`${symbol}:`, '').trim() : `No specific insight for ${symbol}`;
              });
            } else {
              aiSummary = 'AI summary generation failed.';
              aiInsights = stockSymbols.map(() => 'AI insight unavailable');
            }
          } catch (aiError) {
            console.error(`AI generation failed for user ${schedule.user_id}:`, aiError);
            aiSummary = 'AI summary generation failed.';
            aiInsights = stockSymbols.map(() => 'AI insight unavailable');
          }

          // Fetch market indices for context
          const indices = ['^GSPC', '^IXIC', '^DJI'];
          const marketIndices: Array<{ symbol: string; price: number; change: number; changePercent: number }> = [];
          for (const symbol of indices) {
            try {
              const quote = await fetchQuote(symbol);
              if (quote) {
                marketIndices.push({
                  symbol: quote.symbol === '^GSPC' ? 'S&P 500' : quote.symbol === '^IXIC' ? 'NASDAQ' : 'Dow Jones',
                  price: quote.price,
                  change: quote.change,
                  changePercent: quote.changePercent,
                });
              }
            } catch {
              // Skip failed indices
            }
          }

          // Generate Excel data
          const excelData = await generateStockExcelData(stockSymbols, aiInsights);
          const excelBuffer = generateExcelReport(excelData, `Daily Stock Report - ${new Date().toDateString()}`);

          // Send email
          const emailSent = await sendDailyBriefEmail(schedule.email, aiSummary, excelBuffer);

          if (emailSent) {
            sent++;
            console.log(`Successfully sent daily brief to ${schedule.email} for ${stockSymbols.length} stocks`);
            await adminSupabase
              .from("scheduled_reports")
              .update({ last_sent_at: new Date().toISOString() })
              .eq("id", schedule.id);
          } else {
            failed++;
            console.error(`Failed to send email to ${schedule.email}`);
          }

        } catch (err) {
          console.error(`Failed to process scheduled report for user ${schedule.user_id}:`, err);
          failed++;
        }
      }

      return NextResponse.json({
        success: true,
        processed,
        sent,
        failed,
        totalSchedules: schedules.length,
      });
    } else {
      // User mode: generate brief for authenticated user
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Fetch user's holdings
      const { data: holdings, error: holdingsError } = await supabase
        .from("portfolio_holdings")
        .select("symbol, quantity, avg_buy_price")
        .eq("user_id", user.id);

      if (holdingsError) {
        return NextResponse.json(
          { error: "Failed to fetch holdings" },
          { status: 500 }
        );
      }

      if (!holdings || holdings.length === 0) {
        return NextResponse.json(
          { error: "No portfolio holdings found. Add stocks to your portfolio first." },
          { status: 400 }
        );
      }

      const result = await generateBriefForUser(user.id, holdings);

      if (!result) {
        return NextResponse.json(
          { error: "Failed to generate brief" },
          { status: 500 }
        );
      }

      // Save to database
      const { data: brief, error: insertError } = await supabase
        .from("daily_briefs")
        .insert({
          user_id: user.id,
          content: result.content,
          portfolio_snapshot: result.snapshot as unknown as Record<string, unknown>,
        })
        .select("*")
        .single();

      if (insertError || !brief) {
        return NextResponse.json(
          { error: "Failed to save daily brief" },
          { status: 500 }
        );
      }

      return NextResponse.json({ brief, mode: "on-demand" }, { status: 201 });
    }
  } catch (error) {
    console.error("POST /api/daily-brief error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
