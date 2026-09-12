import { NextResponse } from "next/server";
import os from "os";
import QRCode from "qrcode";
import { ensureRealtimeRunning } from "@/lib/lan/realtimeRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function detectLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

export async function GET() {
  try {
    // Ensure the realtime mini-service is up (spawned as a child of this
    // persistent Next.js server process so it survives the sandbox reaper).
    await ensureRealtimeRunning().catch(() => undefined);
    const host = detectLanIp();
    const port = process.env.PORT || 3000;
    const url = `http://${host}:${port}`;
    const qrCodeDataUrl = await QRCode.toDataURL(url);
    return NextResponse.json({ url, host, port: Number(port), qrCodeDataUrl });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
