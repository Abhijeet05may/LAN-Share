import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/lan/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/logout] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
