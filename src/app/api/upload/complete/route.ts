import { NextResponse } from "next/server";
import fs from "fs/promises";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CompleteBody {
  fileId: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompleteBody;
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const fileRecord = await db.fileRecord.findUnique({ where: { id: fileId } });
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const total = fileRecord.totalChunks;
    const partPaths: string[] = [];
    for (let i = 0; i < total; i++) {
      partPaths.push(`${fileRecord.storagePath}.part${i}`);
    }

    // Concatenate all parts in order into the final file.
    const writeHandle = await fs.open(fileRecord.storagePath, "w");
    try {
      for (const p of partPaths) {
        let data: Buffer;
        try {
          data = await fs.readFile(p);
        } catch {
          // Missing chunk — treat as empty (resumable uploads might re-send)
          console.warn(`[upload/complete] missing part: ${p}`);
          data = Buffer.alloc(0);
        }
        if (data.length > 0) {
          await writeHandle.write(data);
        }
      }
    } finally {
      await writeHandle.close();
    }

    // Clean up part files
    await Promise.all(
      partPaths.map((p) =>
        fs.unlink(p).catch(() => {
          /* ignore missing */
        })
      )
    );

    // Verify final file size if possible
    try {
      const stat = await fs.stat(fileRecord.storagePath);
      if (fileRecord.size && stat.size !== fileRecord.size) {
        console.warn(
          `[upload/complete] size mismatch for ${fileId}: expected ${fileRecord.size}, got ${stat.size}`
        );
      }
    } catch (statErr) {
      console.warn(`[upload/complete] could not stat final file:`, statErr);
    }

    const updated = await db.fileRecord.update({
      where: { id: fileId },
      data: { status: "ready" },
    });

    return NextResponse.json({ file: updated });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[upload/complete] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
