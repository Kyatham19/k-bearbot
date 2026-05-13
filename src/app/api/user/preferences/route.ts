import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULTS = {
  default_market: "US" as const,
  theme: "system",
  language_mode: "auto" as const,
  show_charts: true,
  show_news_cards: true,
  notif_brief_email: true,
  notif_in_app: true,
  daily_brief_time: "09:00",
  daily_brief_tz: "Asia/Kolkata",
};

const VALID_MARKETS = new Set(["US", "IN"]);
const VALID_THEMES = new Set(["light", "dark", "system"]);
const VALID_LANG = new Set(["auto", "english", "tanglish"]);

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

    const { data, error } = await supabase
      .from("user_preferences")
      .select(
        "default_market, theme, language_mode, show_charts, show_news_cards, notif_brief_email, notif_in_app, daily_brief_time, daily_brief_tz"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: data ?? DEFAULTS });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (body.default_market !== undefined) {
      if (!VALID_MARKETS.has(body.default_market)) {
        return NextResponse.json({ error: "Invalid default_market" }, { status: 400 });
      }
      patch.default_market = body.default_market;
    }
    if (body.theme !== undefined) {
      if (!VALID_THEMES.has(body.theme)) {
        return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
      }
      patch.theme = body.theme;
    }
    if (body.language_mode !== undefined) {
      if (!VALID_LANG.has(body.language_mode)) {
        return NextResponse.json({ error: "Invalid language_mode" }, { status: 400 });
      }
      patch.language_mode = body.language_mode;
    }
    if (body.show_charts !== undefined) patch.show_charts = !!body.show_charts;
    if (body.show_news_cards !== undefined) patch.show_news_cards = !!body.show_news_cards;
    if (body.notif_brief_email !== undefined) patch.notif_brief_email = !!body.notif_brief_email;
    if (body.notif_in_app !== undefined) patch.notif_in_app = !!body.notif_in_app;
    if (body.daily_brief_time !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(body.daily_brief_time)) {
        return NextResponse.json({ error: "Invalid daily_brief_time (HH:MM)" }, { status: 400 });
      }
      patch.daily_brief_time = body.daily_brief_time;
    }
    if (body.daily_brief_tz !== undefined) {
      if (typeof body.daily_brief_tz !== "string" || body.daily_brief_tz.length > 64) {
        return NextResponse.json({ error: "Invalid daily_brief_tz" }, { status: 400 });
      }
      patch.daily_brief_tz = body.daily_brief_tz;
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, ...patch },
        { onConflict: "user_id" }
      )
      .select(
        "default_market, theme, language_mode, show_charts, show_news_cards, notif_brief_email, notif_in_app, daily_brief_time, daily_brief_tz"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
