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
