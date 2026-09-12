import { NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { db } from "@/lib/db";
import {
  getAllSettings,
  toInt,
  isExtensionAllowed,
} from "@/lib/lan/settings";

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

    // --- Settings enforcement ---
    const s = await getAllSettings();

    // Blocked sender check.
    const blocked = await db.blockedDevice.findUnique({
      where: { deviceId: senderId },
    });
    if (blocked) {
      return NextResponse.json(
        { error: "Device blocked" },
        { status: 403 }
      );
    }

    // Max file size.
    const maxMB = toInt(s["files.maxSizeMB"], 0);
    if (maxMB > 0 && Number(fileSize) > maxMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File exceeds max size (${maxMB}MB)` },
        { status: 413 }
      );
    }

    // Extension whitelist/blacklist.
    const safeOriginal = sanitizeFileName(fileName);
    const ext = getExtension(safeOriginal);
    const extCheck = isExtensionAllowed(
      ext,
      s["files.extensionMode"],
      s["files.extensionList"]
    );
    if (!extCheck.allowed) {
      return NextResponse.json(
        { error: extCheck.reason || "Extension not allowed" },
        { status: 400 }
      );
    }

    // Storage quota.
    const quotaMB = toInt(s["files.storageQuotaMB"], 0);
    if (quotaMB > 0) {
      const quotaBytes = quotaMB * 1024 * 1024;
      const usageAgg = await db.fileRecord.aggregate({
        _sum: { size: true },
      });
      const used = usageAgg._sum.size || 0;
      if (used + Number(fileSize) > quotaBytes) {
        return NextResponse.json(
          { error: "Storage quota exceeded" },
          { status: 507 }
        );
      }
    }
    // --- end enforcement ---

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
