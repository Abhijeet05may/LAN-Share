import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const { id } = await params;

    // Ask the realtime service to disconnect this device now.
    fetch("http://127.0.0.1:3004/internal/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: id, reason: "kicked_by_admin" }),
    }).catch(() => {
      /* realtime service may not be running; ignore */
    });

    await logAdminAction("device_kick", id);

    return adminJson({ ok: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/devices/kick] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
