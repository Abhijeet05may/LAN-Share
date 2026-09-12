import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/lan/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unauthenticated: returns the safe subset of settings used by clients to
// adapt the UI live (hide chat when disabled, etc.). Never includes secrets.
export async function GET() {
  try {
    const settings = await getPublicSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[settings/public] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
