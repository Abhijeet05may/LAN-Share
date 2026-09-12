import { NextResponse } from "next/server";
import {
  ensurePasswordSeed,
  verifyAdminPassword,
  createSessionCookie,
  ADMIN_COOKIE_NAME,
} from "@/lib/lan/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
    };
    const password = typeof body.password === "string" ? body.password : "";

    await ensurePasswordSeed();

    const ok = await verifyAdminPassword(password);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const cookieValue = createSessionCookie();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/login] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
