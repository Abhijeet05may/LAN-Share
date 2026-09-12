import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unauthenticated: the realtime service polls this on connect to reject
// blocked devices before they can join the socket registry.
export async function GET() {
  try {
    const devices = await db.blockedDevice.findMany({
      orderBy: { blockedAt: "desc" },
    });
    return NextResponse.json({ devices });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[blocked-devices] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
