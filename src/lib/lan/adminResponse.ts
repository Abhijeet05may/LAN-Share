import { ADMIN_COOKIE_NAME } from "./adminAuth";
import { NextResponse } from "next/server";

// Helper for auth'd admin routes: returns JSON and, when provided, re-sets the
// admin session cookie with a renewed (sliding-window) value.
export function adminJson(
  data: unknown,
  renewedCookie?: string,
  init?: ResponseInit
): NextResponse {
  const res = NextResponse.json(data, init);
  if (renewedCookie) {
    res.cookies.set(ADMIN_COOKIE_NAME, renewedCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }
  return res;
}

// 401 helper for unauthorized admin calls.
export function adminUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
