import { NextResponse } from "next/server";
import fs from "node:fs";
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
    if (file.status !== "ready") {
      return NextResponse.json(
        { error: `File not ready (status=${file.status})` },
        { status: 404 }
      );
    }

    // Check file exists on disk
    try {
      const stat = await fs.promises.stat(file.storagePath);
      if (!stat.isFile()) {
        return NextResponse.json(
          { error: "File missing on disk" },
          { status: 404 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "File missing on disk" },
        { status: 404 }
      );
    }

    // Increment download count (fire-and-forget)
    try {
      await db.fileRecord.update({
        where: { id },
        data: { downloadCount: { increment: 1 } },
      });
    } catch (err) {
      console.warn("[download/:id] could not increment downloadCount:", err);
    }

    // Stream the file using a Node ReadStream wrapped as a Web ReadableStream.
    const nodeStream = fs.createReadStream(file.storagePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        nodeStream.on("end", () => {
          controller.close();
        });
        nodeStream.on("error", (err) => {
          controller.error(err);
        });
      },
      cancel(reason) {
        nodeStream.destroy();
        console.warn("[download/:id] stream cancelled:", reason);
      },
    });

    // Sanitize filename for Content-Disposition header
    const safeName = (file.originalName || file.name).replace(
      /["\\\r\n]/g,
      ""
    );

    return new Response(
      // Next.js accepts a ReadableStream<Uint8Array> as the body.
      webStream as unknown as BodyInit,
      {
        status: 200,
        headers: {
          "Content-Type": file.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": String(file.size || 0),
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[download/:id] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
