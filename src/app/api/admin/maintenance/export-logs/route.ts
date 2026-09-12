import { NextResponse } from "next/server";
import {
  requireAdmin,
  logAdminAction,
  ADMIN_COOKIE_NAME,
} from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "json").toLowerCase();

    const logs = await db.adminLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 1000,
    });

    await logAdminAction("export_logs", format);

    if (format === "csv") {
      const header = "timestamp,action,actor,detail";
      const rows = logs.map((l) =>
        [
          escapeCsv(l.timestamp instanceof Date ? l.timestamp.toISOString() : String(l.timestamp)),
          escapeCsv(l.action),
          escapeCsv(l.actor),
          escapeCsv(l.detail),
        ].join(",")
      );
      const csv = [header, ...rows].join("\n");
      const res = new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="lan-share-logs.csv"',
        },
      });
      // Renew the sliding-window cookie even on a non-JSON response.
      res.cookies.set(ADMIN_COOKIE_NAME, auth.renewedCookie, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
      return res;
    }

    // Default: JSON
    return adminJson({ logs }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/maintenance/export-logs] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
