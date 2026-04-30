import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ScheduledReport, ScheduledReportInsert } from "@/types/database";

/**
 * GET /api/scheduled-reports - Get user's scheduled reports
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

    const { data: reports, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch scheduled reports" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    console.error("GET /api/scheduled-reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scheduled-reports - Create a new scheduled report
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: Omit<ScheduledReportInsert, 'id' | 'user_id' | 'created_at'> = await request.json();

    // Validate required fields
    if (!body.email || !body.stocks || !Array.isArray(body.stocks) || body.stocks.length === 0 || !body.schedule_time || !body.timezone) {
      return NextResponse.json(
        { error: "Missing required fields: email, stocks (array), schedule_time, timezone" },
        { status: 400 }
      );
    }

    // Validate schedule_time format (HH:MM)
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(body.schedule_time)) {
      return NextResponse.json(
        { error: "Invalid schedule_time format. Use HH:MM (24-hour format)" },
        { status: 400 }
      );
    }

    const insertData: ScheduledReportInsert = {
      user_id: user.id,
      email: body.email,
      stocks: body.stocks,
      schedule_time: body.schedule_time,
      timezone: body.timezone,
      is_active: body.is_active ?? true,
    };

    const { data: report, error } = await supabase
      .from("scheduled_reports")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create scheduled report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("POST /api/scheduled-reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

