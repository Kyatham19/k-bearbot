import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  let dbOk = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("user_preferences").select("user_id").limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      ok: dbOk,
      ts: new Date().toISOString(),
      db: dbOk ? "ok" : "fail",
    },
    { status: dbOk ? 200 : 503 }
  );
}
