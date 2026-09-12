import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getAllSettings, toInt, toBool } from "./settings";

// Throttle: run the sweep at most once every 5 minutes.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweepAt = 0;
let sweeping = false;

/**
 * Sweep expired files based on the admin-configured auto-delete policy.
 *   - "never":           no-op
 *   - "hours":           delete files older than `files.autoDeleteHours`
 *   - "afterDownload":   delete broadcast files once downloaded at least once,
 *                        and targeted files once every listed recipient has
 *                        downloaded (approximated by downloadCount >= recipient count)
 *
 * Throttled to one sweep per 5 minutes. Safe to call from any hot route.
 */
export async function sweepExpiredFiles(): Promise<void> {
  const now = Date.now();
  if (sweeping || now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  sweeping = true;
  lastSweepAt = now;
  try {
    const s = await getAllSettings();
    const mode = s["files.autoDeleteMode"] || "never";
    if (mode === "never") return;

    const files = await db.fileRecord.findMany({
      where: { status: "ready" },
    });

    const toDelete: string[] = [];
    for (const f of files) {
      if (mode === "hours") {
        const hours = toInt(s["files.autoDeleteHours"], 24);
        if (hours > 0) {
          const ageMs = now - new Date(f.createdAt).getTime();
          if (ageMs > hours * 60 * 60 * 1000) toDelete.push(f.id);
        }
      } else if (mode === "afterDownload") {
        // Approximate "all recipients downloaded".
        if (f.isBroadcast) {
          if (f.downloadCount > 0) toDelete.push(f.id);
        } else {
          const recipientCount = f.recipientIds
            ? f.recipientIds.split(",").filter(Boolean).length
            : 0;
          if (recipientCount > 0 && f.downloadCount >= recipientCount) {
            toDelete.push(f.id);
          }
        }
      }
    }

    if (toDelete.length === 0) return;

    // Delete the file bytes + DB records.
    const records = await db.fileRecord.findMany({
      where: { id: { in: toDelete } },
      select: { id: true, storagePath: true },
    });
    for (const r of records) {
      try {
        await fs.unlink(r.storagePath);
      } catch {
        /* file may already be gone — fine */
      }
      // Also clean up any stray .partN chunk files.
      const dir = path.dirname(r.storagePath);
      const base = path.basename(r.storagePath);
      try {
        for (const entry of await fs.readdir(dir)) {
          if (entry.startsWith(`${base}.part`)) {
            await fs.unlink(path.join(dir, entry)).catch(() => {});
          }
        }
      } catch {
        /* ignore */
      }
    }
    await db.fileRecord.updateMany({
      where: { id: { in: toDelete } },
      data: { status: "deleted" },
    });
    // Actually delete the rows so the history stays clean.
    await db.fileRecord.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`[fileExpiry] swept ${toDelete.length} expired file(s) (mode=${mode})`);
  } catch (err) {
    console.error("[fileExpiry] sweep error:", err);
  } finally {
    sweeping = false;
  }
}
