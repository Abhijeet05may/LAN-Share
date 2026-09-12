import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mark a message as read by its recipient. Only private messages carry
// read receipts (group chat doesn't need per-message "seen"). The reader
// must be the message's recipient.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { readerId?: string };
    const readerId = body.readerId || "";

    if (!id) {
      return NextResponse.json(
        { error: "Message id is required" },
        { status: 400 }
      );
    }
    if (!readerId) {
      return NextResponse.json(
        { error: "readerId is required" },
        { status: 400 }
      );
    }

    const msg = await db.message.findUnique({ where: { id } });
    if (!msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Only private messages (recipientId != null) get receipts.
    if (msg.recipientId == null) {
      return NextResponse.json({ ok: true, alreadyRead: true });
    }
    // The reader must be the recipient.
    if (msg.recipientId !== readerId) {
      return NextResponse.json(
        { error: "Only the recipient can mark a message as read" },
        { status: 403 }
      );
    }
    // Idempotent: if already read, no-op.
    if (msg.read) {
      return NextResponse.json({ ok: true, alreadyRead: true });
    }

    await db.message.update({ where: { id }, data: { read: true } });
    return NextResponse.json({ ok: true, id, read: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[messages read POST] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
