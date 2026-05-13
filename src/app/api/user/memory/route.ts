import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      .from("user_memory")
      .select("key, value")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const memory: Record<string, string> = {};
    for (const m of data ?? []) {
      memory[m.key] = m.value;
    }

    return NextResponse.json({ memory });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { key, value } = body as { key?: string; value?: string };
    if (!key || typeof key !== "string" || typeof value !== "string") {
      return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }
    if (key.length > 64 || value.length > 2000) {
      return NextResponse.json({ error: "key/value too long" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_memory")
      .upsert({ user_id: user.id, key, value }, { onConflict: "user_id,key" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const key = new URL(request.url).searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const { error } = await supabase
      .from("user_memory")
      .delete()
      .eq("user_id", user.id)
      .eq("key", key);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
