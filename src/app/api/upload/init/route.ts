import { NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sanitize a filename by stripping path separators and other risky chars.
function sanitizeFileName(name: string): string {
  // Remove any path separators and parent-directory sequences
  return name.replace(/[/\\]/g, "_").replace(/\.\./g, "_");
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0 || idx === fileName.length - 1) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

interface InitBody {
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  isBroadcast: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InitBody;
    const {
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      senderId,
      senderName,
      recipientIds = [],
      isBroadcast = false,
    } = body;

    if (!fileName || !senderId) {
      return NextResponse.json(
        { error: "fileName and senderId are required" },
        { status: 400 }
      );
    }

    // Ensure sender device exists
    await db.device.upsert({
      where: { id: senderId },
      update: { name: senderName, lastSeen: new Date() },
      create: {
        id: senderId,
        name: senderName,
        deviceType: "desktop",
      },
    });

    const safeOriginal = sanitizeFileName(fileName);
    const ext = getExtension(safeOriginal);
    const storedName = `${crypto.randomUUID()}${ext ? "." + ext : ""}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    const storagePath = path.join(uploadsDir, storedName);

    const fileRecord = await db.fileRecord.create({
      data: {
        name: storedName,
        originalName: safeOriginal,
        size: Number(fileSize) || 0,
        mimeType: mimeType || "application/octet-stream",
        extension: ext,
        senderId,
        senderName,
        recipientIds: Array.isArray(recipientIds)
          ? recipientIds.join(",")
          : "",
        isBroadcast: Boolean(isBroadcast),
        storagePath,
        status: "uploading",
        totalChunks: Number(totalChunks) || 0,
        receivedChunks: 0,
      },
    });

    // Ensure uploads dir exists, then create an empty file at storagePath
    // (chunks will be appended as .partN files in the chunk route — the
    // empty base file is created for backwards compatibility and so the
    // path exists on disk.)
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(storagePath, Buffer.alloc(0));
    } catch (fsErr) {
      // Non-fatal — chunk handler will recreate as needed.
      console.warn("[upload/init] could not pre-create storage file:", fsErr);
    }

    return NextResponse.json({ fileId: fileRecord.id });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[upload/init] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
