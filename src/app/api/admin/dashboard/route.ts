import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { requireAdmin } from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import { getAllSettings, toInt } from "@/lib/lan/settings";
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

async function fetchLiveDeviceCount(): Promise<number> {
  try {
    const r = await fetch("http://127.0.0.1:3003/internal/devices", {
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) return 0;
    const data = (await r.json()) as { devices?: RealtimeDevice[] };
    return Array.isArray(data.devices) ? data.devices.length : 0;
  } catch {
    return 0;
  }
}

async function computeStorageUsed(): Promise<number> {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    const entries = await fs.readdir(uploadsDir);
    let total = 0;
    for (const name of entries) {
      try {
        const stat = await fs.stat(path.join(uploadsDir, name));
        if (stat.isFile()) total += stat.size;
      } catch {
        /* ignore */
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const s = await getAllSettings();
    const quotaMB = toInt(s["files.storageQuotaMB"], 0);
    const quotaBytes = quotaMB > 0 ? quotaMB * 1024 * 1024 : 0;

    const [
      storageUsedBytes,
      activeConnections,
      totalDevices,
      totalFiles,
      totalMessages,
    ] = await Promise.all([
      computeStorageUsed(),
      fetchLiveDeviceCount(),
      db.device.count(),
      db.fileRecord.count(),
      db.message.count(),
    ]);

    const storageUsedPercent =
      quotaBytes > 0 ? Math.min(100, (storageUsedBytes / quotaBytes) * 100) : 0;

    return adminJson(
      {
        uptimeSec: Math.floor(process.uptime()),
        storageUsedBytes,
        storageQuotaBytes: quotaBytes,
        storageUsedPercent,
        activeConnections,
        totalDevices,
        totalFiles,
        totalMessages,
        appVersion: "1.0.0",
      },
      auth.renewedCookie
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/dashboard] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
