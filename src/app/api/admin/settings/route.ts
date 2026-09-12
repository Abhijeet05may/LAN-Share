import { NextResponse } from "next/server";
import {
  requireAdmin,
  logAdminAction,
  isDefaultPasswordInUse,
} from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import {
  getAllSettings,
  setSettings,
  DEFAULT_SETTINGS,
} from "@/lib/lan/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — full settings map (with admin.passwordHash stripped). Auth required.
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const all = await getAllSettings();
    const { ["admin.passwordHash"]: _stripped, ...safe } = all;
    void _stripped;
    const isDefaultPassword = await isDefaultPasswordInUse();

    return adminJson(
      { settings: safe, isDefaultPassword },
      auth.renewedCookie
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/settings GET] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

// PUT — update settings. Only keys that exist in DEFAULT_SETTINGS are allowed;
// admin.passwordHash is never writable from here (auth changes go via /password).
export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const body = (await request.json().catch(() => ({}))) as {
      settings?: Record<string, string>;
    };
    const incoming = body.settings || {};

    const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS));
    allowedKeys.delete("admin.passwordHash"); // never writable here

    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (!allowedKeys.has(key)) continue;
      if (typeof value !== "string") continue;
      updates[key] = value;
    }

    if (Object.keys(updates).length > 0) {
      await setSettings(updates);
    }

    // Fire-and-forget: tell realtime to push a `settings:updated` event to
    // every connected client so they can refetch /api/settings/public.
    fetch("http://127.0.0.1:3004/internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "settings:updated", payload: {} }),
    }).catch(() => {
      /* realtime service may not be running; ignore */
    });

    await logAdminAction(
      "settings_update",
      JSON.stringify(Object.keys(updates))
    );

    return adminJson({ ok: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/settings PUT] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
