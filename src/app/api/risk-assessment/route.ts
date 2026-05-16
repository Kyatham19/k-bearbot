import { NextRequest, NextResponse } from "next/server";
import { assessPortfolioRisk } from "@/lib/ai/risk-assessment";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { portfolioData, newsContext } = body;
    if (!portfolioData) {
      return NextResponse.json(
        { error: "portfolioData is required" },
        { status: 400 }
      );
    }
    const result = await assessPortfolioRisk(
      portfolioData,
      newsContext || ""
    );

    return NextResponse.json({ result });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
