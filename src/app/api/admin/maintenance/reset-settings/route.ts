import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import { resetSettings } from "@/lib/lan/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    await resetSettings();

    // Tell clients to refetch public settings (now back to defaults).
    fetch("http://127.0.0.1:3003/internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "settings:updated", payload: {} }),
    }).catch(() => {
      /* realtime service may not be running; ignore */
    });

    await logAdminAction("reset_settings");

    return adminJson({ ok: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/maintenance/reset-settings] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
