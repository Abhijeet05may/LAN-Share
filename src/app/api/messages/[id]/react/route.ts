import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle an emoji reaction on a message. If the (messageId, deviceId, emoji)
// reaction already exists, it's removed (toggle off). Otherwise it's created.
// Returns the full reaction list for that message so the client can sync.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      deviceId?: string;
      deviceName?: string;
      emoji?: string;
    };
    const deviceId = body.deviceId || "";
    const deviceName = body.deviceName || "";
    const emoji = (body.emoji || "").trim();

    if (!id || !deviceId || !emoji) {
      return NextResponse.json(
        { error: "id, deviceId, and emoji are required" },
        { status: 400 }
      );
    }

    // Check if the reaction already exists (toggle).
    const existing = await db.reaction.findUnique({
      where: {
        messageId_deviceId_emoji: { messageId: id, deviceId, emoji },
      },
    });

    let action: "added" | "removed";
    if (existing) {
      await db.reaction.delete({ where: { id: existing.id } });
      action = "removed";
    } else {
      await db.reaction.create({
        data: { messageId: id, deviceId, deviceName, emoji },
      });
      action = "added";
    }

    // Return the full reaction list for this message so the client can sync.
    const reactions = await db.reaction.findMany({
      where: { messageId: id },
      select: { id: true, deviceId: true, deviceName: true, emoji: true },
    });

    return NextResponse.json({ ok: true, action, reactions });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[messages react POST] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
