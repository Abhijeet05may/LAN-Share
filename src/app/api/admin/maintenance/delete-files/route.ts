import { NextResponse } from "next/server";
import fs from "fs/promises";
import { requireAdmin, logAdminAction } from "@/lib/lan/adminAuth";
import { adminJson, adminUnauthorized } from "@/lib/lan/adminResponse";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return adminUnauthorized();

    const files = await db.fileRecord.findMany();
    // Best-effort unlink; ignore any per-file errors so the DB cleanup still
    // runs and the admin isn't blocked by a single missing file.
    await Promise.all(
      files.map((f) =>
        fs.unlink(f.storagePath).catch(() => {
          /* ignore */
        })
      )
    );
    await db.fileRecord.deleteMany({});
    await logAdminAction("delete_files");

    return adminJson({ ok: true }, auth.renewedCookie);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[admin/maintenance/delete-files] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
