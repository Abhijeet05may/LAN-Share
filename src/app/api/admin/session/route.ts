import { NextResponse } from "next/server";
import {
  requireAdmin,
  isDefaultPasswordInUse,
} from "@/lib/lan/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No auth required: used by the UI to decide whether to show the login screen
// or the admin panel. We never leak the password hash; we only report whether
// the caller is currently authenticated and whether the default password is
// still in use (so the UI can show a "change me" banner).
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const isDefaultPassword = await isDefaultPasswordInUse();
    return NextResponse.json({
      authenticated: !!auth,
      isDefaultPassword,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/session] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
