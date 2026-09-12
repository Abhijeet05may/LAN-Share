import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import zlib from "zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal ZIP (store mode, no compression) builder using pure Node.js built-ins.
// Produces a valid .zip archive from a list of file paths + names.
function buildZip(
  entries: { path: string; name: string }[]
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    let data: Buffer;
    try {
      data = fs.readFileSync(entry.path);
    } catch {
      continue; // skip missing files
    }
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = zlib.crc32(data);
    const size = data.length;

    // Local file header (30 bytes + name)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression: store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x0021, 12); // mod date (1980-01-01)
    local.writeUInt32LE(crc >>> 0, 14); // crc-32
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // filename length
    local.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(local, 30);

    localParts.push(local, data);

    // Central directory entry (46 bytes + name)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // compression: store
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0x0021, 14); // mod date
    central.writeUInt32LE(crc >>> 0, 16); // crc-32
    central.writeUInt32LE(size, 20); // compressed size
    central.writeUInt32LE(size, 24); // uncompressed size
    central.writeUInt16LE(nameBuf.length, 28); // filename length
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(central, 46);

    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const localBuf = Buffer.concat(localParts);

  // End of central directory record (22 bytes)
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralBuf.length, 12); // size of central directory
  end.writeUInt32LE(localBuf.length, 16); // offset of central directory
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localBuf, centralBuf, end]);
}

// POST /api/files/zip — accepts { fileIds: string[], deviceId: string }
// Returns a zip archive of the requested files as a download. Only includes
// files the requesting device is allowed to see.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fileIds?: string[];
      deviceId?: string;
    };
    const fileIds = body.fileIds || [];
    const deviceId = body.deviceId || "";

    if (!fileIds.length || !deviceId) {
      return NextResponse.json(
        { error: "fileIds and deviceId are required" },
        { status: 400 }
      );
    }

    const records = await db.fileRecord.findMany({
      where: {
        id: { in: fileIds },
        status: "ready",
        OR: [
          { senderId: deviceId },
          { isBroadcast: true },
          { recipientIds: { contains: deviceId } },
        ],
      },
    });

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No accessible files found for the given IDs" },
        { status: 404 }
      );
    }

    // Deduplicate file names.
    const usedNames = new Set<string>();
    const entries = records.map((rec) => {
      let name = rec.originalName || rec.name;
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : "";
        let i = 1;
        while (usedNames.has(`${base} (${i})${ext}`)) i++;
        name = `${base} (${i})${ext}`;
      }
      usedNames.add(name);
      return { path: rec.storagePath, name };
    });

    const zipBuf = buildZip(entries);

    return new NextResponse(zipBuf as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="lan-share-files.zip"`,
        "Content-Length": String(zipBuf.length),
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[files/zip] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
