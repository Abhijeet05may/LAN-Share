import { NextResponse } from "next/server";
import {
  requireAdmin,
  verifyAdminPassword,
  setAdminPassword,
  logAdminAction,
} from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const body = (await request.json().catch(() => ({}))) as {
      current?: string;
      new?: string;
    };
    const current = typeof body.current === "string" ? body.current : "";
    const next = typeof body.new === "string" ? body.new : "";

    if (!next) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
    }

    const ok = await verifyAdminPassword(current);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 }
      );
    }

    await setAdminPassword(next);
    await logAdminAction("password_change");

    return adminJson({ ok: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/password] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
