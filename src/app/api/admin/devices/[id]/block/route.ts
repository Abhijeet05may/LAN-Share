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
    const body = (await request.json().catch(() => ({}))) as {
      reason?: string;
    };
    const reason = typeof body.reason === "string" ? body.reason : "";

    // Look up the device for name/ip snapshot.
    const device = await db.device.findUnique({ where: { id } });
    const name = device?.name ?? "";
    const ip = device?.ip ?? "";

    await db.blockedDevice.upsert({
      where: { deviceId: id },
      create: { deviceId: id, name, ip, reason },
      update: { reason },
    });

    // Tell the realtime service to disconnect the device immediately.
    fetch("http://127.0.0.1:3004/internal/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: id, reason: "blocked" }),
    }).catch(() => {
      /* realtime service may not be running; ignore */
    });

    await logAdminAction("device_block", id);

    return adminJson({ ok: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/devices/block] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
