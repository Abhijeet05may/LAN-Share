import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAllSettings,
  toBool,
  toInt,
} from "@/lib/lan/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-memory rate limiter for chat messages. Per-device counter over a
// rolling 60s window. Best-effort: state is lost on process restart, which is
// acceptable for a LAN app.
interface RateBucket {
  count: number;
  windowStart: number;
}
const messageRateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;

function rateLimitHit(deviceId: string, maxPerMin: number): boolean {
  if (maxPerMin <= 0) return false;
  const now = Date.now();
  const bucket = messageRateBuckets.get(deviceId);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    messageRateBuckets.set(deviceId, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxPerMin;
}

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

    // --- Settings enforcement ---
    const s = await getAllSettings();

    // Blocked sender check.
    const blocked = await db.blockedDevice.findUnique({
      where: { deviceId: senderId },
    });
    if (blocked) {
      return NextResponse.json(
        { error: "Device blocked" },
        { status: 403 }
      );
    }

    // Group/private enable flags.
    if (recipientId == null && !toBool(s["chat.groupEnabled"])) {
      return NextResponse.json(
        { error: "Group chat disabled" },
        { status: 403 }
      );
    }
    if (recipientId != null && !toBool(s["chat.privateEnabled"])) {
      return NextResponse.json(
        { error: "Private chat disabled" },
        { status: 403 }
      );
    }

    // Max message length.
    const maxLen = toInt(s["chat.maxMessageLength"], 0);
    if (maxLen > 0 && content.length > maxLen) {
      return NextResponse.json(
        { error: "Message too long" },
        { status: 400 }
      );
    }

    // Rate limit (best-effort, in-memory).
    const maxPerMin = toInt(s["security.maxMessagesPerMin"], 0);
    if (rateLimitHit(senderId, maxPerMin)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }
    // --- end enforcement ---

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
        include: {
          reactions: {
            select: { id: true, deviceId: true, deviceName: true, emoji: true },
          },
        },
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
      include: {
        reactions: {
          select: { id: true, deviceId: true, deviceName: true, emoji: true },
        },
      },
    });
    messages.reverse();
    return NextResponse.json({ messages });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[messages GET] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
