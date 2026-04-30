import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/scheduled-reports/[id] - Update a scheduled report
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });
    }

    const body: any = await request.json();

    // Validate schedule_time format if provided
    if (body.schedule_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(body.schedule_time)) {
      return NextResponse.json(
        { error: "Invalid schedule_time format. Use HH:MM (24-hour format)" },
        { status: 400 }
      );
    }

    const { data: report, error } = await supabase
      .from("scheduled_reports")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update scheduled report" },
        { status: 500 }
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: "Scheduled report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("PUT /api/scheduled-reports/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scheduled-reports/[id] - Delete a scheduled report
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("scheduled_reports")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete scheduled report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/scheduled-reports/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}