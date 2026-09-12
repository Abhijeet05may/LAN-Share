import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper: returns true if `csv` contains `id` as one of its comma-separated values.
function csvContains(csv: string, id: string): boolean {
  if (!csv || !id) return false;
  return csv
    .split(",")
    .map((s) => s.trim())
    .includes(id);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId") || "";
    const scope = (searchParams.get("scope") || "all") as
      | "all"
      | "sent"
      | "received";

    if (scope === "sent") {
      // Files sent by this device.
      const where: Prisma.FileRecordWhereInput = {
        senderId: deviceId,
      };
      const files = await db.fileRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ files });
    }

    if (scope === "received") {
      // Files visible to this device as a recipient but not sent by them:
      // broadcast OR recipientIds contains deviceId, AND senderId != deviceId.
      // We fetch a candidate set and filter in JS for accurate CSV word match.
      const candidates = await db.fileRecord.findMany({
        where: {
          status: "ready",
          senderId: { not: deviceId },
          OR: [{ isBroadcast: true }, { recipientIds: { contains: deviceId } }],
        },
        orderBy: { createdAt: "desc" },
      });
      const files = candidates.filter(
        (f) => f.isBroadcast || csvContains(f.recipientIds, deviceId)
      );
      return NextResponse.json({ files });
    }

    // scope === "all"
    // All ready files the device can see: sent by them, OR broadcast,
    // OR recipientIds contains deviceId.
    if (!deviceId) {
      // Anonymous viewer: only broadcasts.
      const files = await db.fileRecord.findMany({
        where: { status: "ready", isBroadcast: true },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ files });
    }

    const candidates = await db.fileRecord.findMany({
      where: {
        status: "ready",
        OR: [
          { senderId: deviceId },
          { isBroadcast: true },
          { recipientIds: { contains: deviceId } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    const files = candidates.filter(
      (f) =>
        f.senderId === deviceId ||
        f.isBroadcast ||
        csvContains(f.recipientIds, deviceId)
    );
    return NextResponse.json({ files });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[files] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
