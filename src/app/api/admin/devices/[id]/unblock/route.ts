import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import { db } from "@/lib/db";

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

    await db.blockedDevice.deleteMany({ where: { deviceId: id } });

    // Broadcast to all clients so they can restore the device to their lists.
    fetch("http://127.0.0.1:3004/internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "device:unblocked",
        payload: { deviceId: id },
      }),
    }).catch(() => {
      /* realtime service may not be running; ignore */
    });

    await logAdminAction("device_unblock", id);

    return adminJson({ ok: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/devices/unblock] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
