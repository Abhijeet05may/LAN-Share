import { NextResponse } from "next/server";
import fs from "fs/promises";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileId = String(formData.get("fileId") || "");
    const chunkIndexRaw = formData.get("chunkIndex");
    const chunkIndex = Number(chunkIndexRaw);
    const chunk = formData.get("chunk");

    if (!fileId || Number.isNaN(chunkIndex)) {
      return NextResponse.json(
        { error: "fileId and chunkIndex are required" },
        { status: 400 }
      );
    }

    if (!chunk || !(chunk instanceof File)) {
      return NextResponse.json(
        { error: "Missing 'chunk' file field" },
        { status: 400 }
      );
    }

    const fileRecord = await db.fileRecord.findUnique({ where: { id: fileId } });
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Store the chunk as a separate part file for robustness and resumability.
    // Final assembly happens in /api/upload/complete.
    const partPath = `${fileRecord.storagePath}.part${chunkIndex}`;
    const buf = Buffer.from(await chunk.arrayBuffer());
    await fs.writeFile(partPath, buf);

    const updated = await db.fileRecord.update({
      where: { id: fileId },
      data: { receivedChunks: { increment: 1 } },
    });

    return NextResponse.json({
      fileId,
      receivedChunks: updated.receivedChunks,
      totalChunks: fileRecord.totalChunks,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[upload/chunk] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
