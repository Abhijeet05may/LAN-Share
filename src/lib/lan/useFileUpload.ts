"use client";

import { useCallback, useRef } from "react";
import { useLanStore } from "./store";
import { lanSocket } from "./socketManager";
import { chunkedUpload } from "./upload";
import { formatBytes } from "./device";
import { toast } from "sonner";
import type { FileRecord } from "./types";

/**
 * Shared file-upload logic used by FileShare (Files tab) and the sidebar
 * drag-drop-onto-device shortcut. Handles the chunked upload + transfer
 * tracking + socket notification + toast feedback + abort/cancel.
 *
 * `uploadFiles(fileList, { recipientIds, isBroadcast, recipientLabel })` is the
 * public entry point. Pass `isBroadcast: true` for "Everyone", or
 * `recipientIds: [deviceId]` for a targeted send.
 */
export function useFileUpload() {
  const self = useLanStore((s) => s.self);
  const addTransfer = useLanStore((s) => s.addTransfer);
  const updateTransfer = useLanStore((s) => s.updateTransfer);
  const removeTransfer = useLanStore((s) => s.removeTransfer);
  const addFile = useLanStore((s) => s.addFile);
  const publicSettings = useLanStore((s) => s.publicSettings);

  // Per-transfer AbortControllers so uploads can be cancelled.
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const cancelTransfer = useCallback((transferId: string) => {
    const ctrl = abortControllers.current.get(transferId);
    if (ctrl) {
      ctrl.abort();
      abortControllers.current.delete(transferId);
    }
  }, []);

  const uploadFiles = useCallback(
    async (
      fileList: FileList | File[],
      opts: {
        recipientIds: string[]; // empty => broadcast
        isBroadcast: boolean;
        recipientLabel: string;
      }
    ) => {
      if (!self) return;
      const arr = Array.from(fileList);
      if (arr.length === 0) return;
      const maxFileBytes = publicSettings.maxFileBytes;

      // Client-side max-file-size guard (server also enforces).
      if (maxFileBytes > 0) {
        const tooBig = arr.filter((f) => f.size > maxFileBytes);
        if (tooBig.length) {
          toast.error(`${tooBig.length} file(s) exceed the size limit`, {
            description: `Max ${formatBytes(maxFileBytes)} · ${tooBig
              .map((f) => f.name)
              .slice(0, 3)
              .join(", ")}`,
          });
        }
      }

      for (const file of arr) {
        if (maxFileBytes > 0 && file.size > maxFileBytes) continue;
        const transferId = `t_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        addTransfer({
          id: transferId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          senderName: self.name,
          uploadedBytes: 0,
          totalBytes: file.size,
          status: "uploading",
          recipientLabel: opts.recipientLabel,
          startedAt: Date.now(),
        });

        const abortCtrl = new AbortController();
        abortControllers.current.set(transferId, abortCtrl);

        try {
          const result = await chunkedUpload({
            file,
            senderId: self.deviceId,
            senderName: self.name,
            recipientIds: opts.recipientIds,
            isBroadcast: opts.isBroadcast,
            recipientLabel: opts.recipientLabel,
            signal: abortCtrl.signal,
            onProgress: (uploaded, total) => {
              updateTransfer(transferId, {
                uploadedBytes: uploaded,
                totalBytes: total,
              });
            },
          });
          const fRes = await fetch(`/api/files/${result.fileId}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            const fileRecord: FileRecord = fData.file;
            addFile(fileRecord);
            const socket = lanSocket.get();
            if (socket?.connected) {
              socket.emit("file:sent", {
                file: fileRecord,
                senderId: self.deviceId,
                senderName: self.name,
              });
            }
          }
          updateTransfer(transferId, { status: "completed" });
          toast.success(`Sent “${result.fileName}”`, {
            description: `To ${opts.recipientLabel} · ${formatBytes(result.fileSize)}`,
          });
          setTimeout(() => removeTransfer(transferId), 4000);
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            removeTransfer(transferId);
            toast.info(`Cancelled “${file.name}”`);
            continue;
          }
          updateTransfer(transferId, { status: "error" });
          toast.error(`Failed to send “${file.name}”`, {
            description: (err as Error).message,
          });
          setTimeout(() => removeTransfer(transferId), 6000);
        } finally {
          abortControllers.current.delete(transferId);
        }
      }
    },
    [self, addTransfer, updateTransfer, addFile, removeTransfer, publicSettings]
  );

  return { uploadFiles, cancelTransfer };
}
