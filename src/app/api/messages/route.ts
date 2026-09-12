import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  senderId: string;
  senderName: string;
  recipientId: string | null;
  content: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;
    const { senderId, senderName, recipientId, content } = body;

    if (!senderId || !content) {
      return NextResponse.json(
        { error: "senderId and content are required" },
        { status: 400 }
      );
    }

    // Upsert sender device
    await db.device.upsert({
      where: { id: senderId },
      update: { name: senderName, lastSeen: new Date() },
      create: {
        id: senderId,
        name: senderName,
        deviceType: "desktop",
      },
    });

    // If recipient is set, ensure their device exists too (placeholder name).
    if (recipientId) {
      await db.device.upsert({
        where: { id: recipientId },
        update: { lastSeen: new Date() },
        create: {
          id: recipientId,
          name: "Unknown Device",
          deviceType: "desktop",
        },
      });
    }

    const message = await db.message.create({
      data: {
        senderId,
        senderName,
        recipientId: recipientId || null,
        content,
      },
    });

    return NextResponse.json({ message });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[messages POST] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId") || "";
    const type = (searchParams.get("type") || "group") as "group" | "private";
    const peerId = searchParams.get("peerId") || "";

    if (type === "private") {
      if (!deviceId || !peerId) {
        return NextResponse.json(
          { error: "deviceId and peerId are required for private messages" },
          { status: 400 }
        );
      }
      // Last 200 messages of the private conversation, ordered ascending by time.
      const messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: deviceId, recipientId: peerId },
            { senderId: peerId, recipientId: deviceId },
          ],
        },
        orderBy: { timestamp: "desc" },
        take: 200,
      });
      // Reverse so oldest is first
      messages.reverse();
      return NextResponse.json({ messages });
    }

    // group: recipientId is null. Last 200, oldest-first.
    const messages = await db.message.findMany({
      where: { recipientId: null },
      orderBy: { timestamp: "desc" },
      take: 200,
    });
    messages.reverse();
    return NextResponse.json({ messages });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[messages GET] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
