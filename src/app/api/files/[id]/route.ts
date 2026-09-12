import { NextResponse } from "next/server";
import fs from "fs/promises";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const file = await db.fileRecord.findUnique({ where: { id } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json(file);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[files/:id GET] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const file = await db.fileRecord.findUnique({ where: { id } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Remove the file from disk (and any stray .partN files).
    try {
      await fs.unlink(file.storagePath);
    } catch (err) {
      // Non-fatal if file already gone.
      console.warn("[files/:id DELETE] could not unlink file:", err);
    }
    try {
      // Best-effort cleanup of leftover chunk parts.
      const dir = file.storagePath.slice(0, file.storagePath.lastIndexOf("/"));
      const base = file.storagePath.slice(
        file.storagePath.lastIndexOf("/") + 1
      );
      const entries = await fs.readdir(dir);
      await Promise.all(
        entries
          .filter((e) => e.startsWith(`${base}.part`))
          .map((e) =>
            fs.unlink(`${dir}/${e}`).catch(() => {
              /* ignore */
            })
          )
      );
    } catch {
      /* ignore */
    }

    await db.fileRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[files/:id DELETE] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
