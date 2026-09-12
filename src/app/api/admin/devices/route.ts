import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RealtimeDevice {
  deviceId?: string;
  name?: string;
  deviceType?: string;
  ip?: string;
  socketId?: string;
}

// Fetch the live device registry from the realtime service. Best-effort: any
// network failure returns an empty list (admin UI degrades gracefully to
// "all offline").
async function fetchLiveDevices(): Promise<RealtimeDevice[]> {
  try {
    const r = await fetch("http://127.0.0.1:3003/internal/devices", {
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { devices?: RealtimeDevice[] };
    return Array.isArray(data.devices) ? data.devices : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const [devices, blocked, live] = await Promise.all([
      db.device.findMany({ orderBy: { lastSeen: "desc" } }),
      db.blockedDevice.findMany(),
      fetchLiveDevices(),
    ]);

    const onlineIds = new Set(
      live.map((d) => d.deviceId).filter((x): x is string => !!x)
    );
    const blockedIds = new Set(blocked.map((b) => b.deviceId));

    const out = devices.map((d) => ({
      id: d.id,
      name: d.name,
      deviceType: d.deviceType,
      userAgent: d.userAgent,
      ip: d.ip,
      avatarColor: d.avatarColor,
      createdAt: d.createdAt,
      lastSeen: d.lastSeen,
      online: onlineIds.has(d.id),
      blocked: blockedIds.has(d.id),
    }));

    return adminJson({ devices: out }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/devices GET] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
