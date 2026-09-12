// Chunked, resumable file upload helper.
// Splits a file into chunks, uploads each to /api/upload/chunk with progress,
// then finalizes with /api/upload/complete.

const CHUNK_SIZE = 512 * 1024; // 512 KB chunks

export interface UploadOptions {
  file: File;
  senderId: string;
  senderName: string;
  recipientIds: string[]; // empty => broadcast
  isBroadcast: boolean;
  recipientLabel: string;
  onProgress: (uploadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  fileSize: number;
}

export async function chunkedUpload(opts: UploadOptions): Promise<UploadResult> {
  const { file, senderId, senderName, recipientIds, isBroadcast, onProgress, signal } = opts;

  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const mimeType = file.type || "application/octet-stream";
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : "";

  // 1. Init
  const initRes = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      totalChunks,
      senderId,
      senderName,
      recipientIds,
      isBroadcast,
    }),
    signal,
  });
  if (!initRes.ok) throw new Error(`Upload init failed: ${initRes.status}`);
  const { fileId } = await initRes.json();

  // 2. Upload chunks sequentially (resumable: server stores .partN files).
  let uploadedBytes = 0;
  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    await uploadChunk(fileId, i, chunk, signal);
    uploadedBytes += end - start;
    onProgress(uploadedBytes, file.size);
  }

  // 3. Complete
  const completeRes = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
    signal,
  });
  if (!completeRes.ok) throw new Error(`Upload complete failed: ${completeRes.status}`);

  return { fileId, fileName: file.name, fileSize: file.size };
}

// Upload a single chunk with XHR for progress + abort support.
function uploadChunk(
  fileId: string,
  chunkIndex: number,
  chunk: Blob,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("fileId", fileId);
    form.append("chunkIndex", String(chunkIndex));
    form.append("chunk", chunk, `chunk-${chunkIndex}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/chunk");
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Chunk ${chunkIndex} failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error(`Chunk ${chunkIndex} network error`));
    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
      });
    }
    xhr.send(form);
  });
}

// Trigger a browser download for a file id.
export function downloadFile(fileId: string) {
  const a = document.createElement("a");
  a.href = `/api/download/${fileId}`;
  a.download = "";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
