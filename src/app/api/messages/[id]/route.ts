import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE a message. Only the original sender may delete their own message.
// Admins could be allowed too, but for the LAN app we keep it simple: sender-only.
// The realtime `chat:deleted` fan-out is handled by the calling client via socket.io
// (see src/components/lan/ChatPanel.tsx) so other devices remove it live.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get("senderId") || "";

    if (!id) {
      return NextResponse.json(
        { error: "Message id is required" },
        { status: 400 }
      );
    }
    if (!senderId) {
      return NextResponse.json(
        { error: "senderId is required to authorize deletion" },
        { status: 400 }
      );
    }

    const msg = await db.message.findUnique({ where: { id } });
    if (!msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Only the original sender may delete.
    if (msg.senderId !== senderId) {
      return NextResponse.json(
        { error: "You can only delete your own messages" },
        { status: 403 }
      );
    }

    await db.message.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[messages DELETE] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

// PATCH (edit) a message's content. Only the original sender may edit.
// The realtime `chat:edited` fan-out is handled by the calling client via socket.io
// (see src/components/lan/ChatPanel.tsx) so other devices update live.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { senderId?: string; content?: string };
    const senderId = body.senderId || "";
    const content = (body.content || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Message id is required" },
        { status: 400 }
      );
    }
    if (!senderId) {
      return NextResponse.json(
        { error: "senderId is required to authorize editing" },
        { status: 400 }
      );
    }
    if (!content) {
      return NextResponse.json(
        { error: "Content cannot be empty" },
        { status: 400 }
      );
    }

    const msg = await db.message.findUnique({ where: { id } });
    if (!msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Only the original sender may edit.
    if (msg.senderId !== senderId) {
      return NextResponse.json(
        { error: "You can only edit your own messages" },
        { status: 403 }
      );
    }

    const updated = await db.message.update({
      where: { id },
      data: { content: content.slice(0, 5000) },
    });
    return NextResponse.json({ ok: true, message: updated });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[messages PATCH] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
