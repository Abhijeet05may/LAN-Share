import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    await db.message.deleteMany({});
    await logAdminAction("clear_chat");

    return adminJson({ ok: true, deleted: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/maintenance/clear-chat] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
