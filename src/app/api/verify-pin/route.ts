import { NextResponse } from "next/server";
import { getSetting, toBool } from "@/lib/lan/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unauthenticated PIN verification. The PIN is the secret, so this endpoint
// takes a guess and returns ok/fail rather than ever leaking the configured
// value. Used by the realtime service on device:join.
export async function POST(request: Request) {
  try {
    const { pin } = (await request.json()) as { pin?: string };
    const pinEnabled = toBool(await getSetting("network.pinEnabled"));
    if (!pinEnabled) {
      // PINs are disabled — always allow.
      return NextResponse.json({ ok: true });
    }
    const expected = (await getSetting("network.pin")) || "";
    const supplied = (pin || "").trim();
    if (!expected) {
      // PIN enabled but no PIN configured — allow (admin misconfiguration).
      return NextResponse.json({ ok: true });
    }
    if (!supplied) {
      return NextResponse.json(
        { ok: false, error: "A room PIN is required to join this network." },
        { status: 403 }
      );
    }
    // Timing-safe-ish comparison (constant-time over equal-length strings).
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    const ok = a.length === b.length && a.equals(b);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Incorrect PIN" },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
