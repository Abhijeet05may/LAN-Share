"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  File as FileIcon,
  Download,
  Trash2,
  ArrowUpDown,
  Users,
  User,
  CheckCircle2,
  X,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  Code,
  Sheet,
  Eye,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useLanStore } from "@/lib/lan/store";
import { lanSocket } from "@/lib/lan/socketManager";
import { downloadFile } from "@/lib/lan/upload";
import { useFileUpload } from "@/lib/lan/useFileUpload";
import {
  fileKind,
  formatBytes,
  relativeTime,
  isPreviewable,
  isImageMime,
} from "@/lib/lan/device";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { FileRecord } from "@/lib/lan/types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  "file-text": FileText,
  film: Film,
  music: Music,
  archive: Archive,
  code: Code,
  sheet: Sheet,
  file: FileIcon,
};

export function FileShare() {
  const self = useLanStore((s) => s.self);
  const devices = useLanStore((s) => s.devices);
  const files = useLanStore((s) => s.files);
  const setFiles = useLanStore((s) => s.setFiles);
  const transfers = useLanStore((s) => s.transfers);
  const removeFile = useLanStore((s) => s.removeFile);
  const publicSettings = useLanStore((s) => s.publicSettings);

  // Shared upload logic (also used by the sidebar drag-drop shortcut).
  const { uploadFiles, cancelTransfer } = useFileUpload();

  const [dragOver, setDragOver] = useState(false);
  const [broadcast, setBroadcast] = useState(true);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "doc" | "video" | "other">("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewEnabled = publicSettings.filePreviewEnabled;

  const others = devices.filter((d) => d.deviceId !== self?.deviceId);

  // Filter + sort file history.
  const filteredFiles = useMemo(() => {
    let list = files;
    if (typeFilter !== "all") {
      list = list.filter((f) => {
        const mime = f.mimeType || "";
        const ext = (f.extension || "").toLowerCase();
        if (typeFilter === "image") return /^image\//.test(mime);
        if (typeFilter === "video") return /^video\//.test(mime);
        if (typeFilter === "doc")
          return (
            mime === "application/pdf" ||
            ["doc", "docx", "txt", "md", "pdf", "rtf"].includes(ext)
          );
        // other = not image/video/doc
        return !/^image\//.test(mime) && !/^video\//.test(mime) && mime !== "application/pdf";
      });
    }
    // Sort a copy so we don't mutate the store array.
    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) => (a.originalName || "").localeCompare(b.originalName || ""));
    } else if (sortBy === "size") {
      sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
    } else {
      // date desc (default) — newest first
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }, [files, typeFilter, sortBy]);

  // Load file history.
  const refreshFiles = useCallback(async () => {
    if (!self) return;
    try {
      const res = await fetch(
        `/api/files?deviceId=${encodeURIComponent(self.deviceId)}&scope=all`
      );
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch {
      /* ignore */
    }
  }, [self, setFiles]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // Handle selected files via the shared upload hook.
  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!self) return;
      const arr = Array.from(fileList);
      if (arr.length === 0) return;

      if (!broadcast && selectedRecipients.length === 0 && others.length > 0) {
        toast.error("Select at least one recipient or choose “Everyone”.");
        return;
      }

      const recipientLabel = broadcast
        ? "Everyone"
        : selectedRecipients
            .map((id) => devices.find((d) => d.deviceId === id)?.name || "device")
            .join(", ");

      await uploadFiles(fileList, {
        recipientIds: broadcast ? [] : selectedRecipients,
        isBroadcast: broadcast,
        recipientLabel,
      });
    },
    [self, broadcast, selectedRecipients, others.length, devices, uploadFiles]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        removeFile(id);
        toast.success("File deleted");
      }
    } catch {
      toast.error("Failed to delete file");
    }
  };

  const handleDownload = (f: FileRecord) => {
    downloadFile(f.id);
    const socket = lanSocket.get();
    if (socket?.connected && self && f.senderId !== self.deviceId) {
      socket.emit("file:downloaded", {
        fileId: f.id,
        downloaderId: self.deviceId,
        downloaderName: self.name,
        senderId: f.senderId,
      });
    }
    toast.success(`Downloading “${f.originalName}”`);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-3 sm:p-5 space-y-4 max-w-4xl mx-auto w-full">
          {/* Upload zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "relative rounded-2xl border-2 border-dashed transition-all p-6 sm:p-8 text-center",
              dragOver
                ? "border-brand bg-brand/5 scale-[1.01]"
                : "border-border hover:border-brand/50 hover:bg-muted/40"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center transition-transform",
                  dragOver
                    ? "bg-brand text-brand-foreground scale-110"
                    : "bg-brand/15 text-brand"
                )}
              >
                <Upload className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Drop files to share, or{" "}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-brand underline underline-offset-2 hover:opacity-80 font-medium"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multiple files supported · chunked upload for reliability
                </p>
              </div>
            </div>
          </div>

          {/* Recipient picker */}
          <div className="rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground mr-1">
                Send to:
              </span>
              <button
                onClick={() => {
                  setBroadcast(true);
                  setSelectedRecipients([]);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                  broadcast
                    ? "bg-brand text-brand-foreground border-brand"
                    : "bg-background hover:bg-muted"
                )}
              >
                <Globe className="h-3.5 w-3.5" /> Everyone
              </button>
              {others.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No other devices online
                </span>
              ) : (
                others.map((d) => {
                  const sel = selectedRecipients.includes(d.deviceId);
                  return (
                    <button
                      key={d.deviceId}
                      onClick={() => {
                        setBroadcast(false);
                        toggleRecipient(d.deviceId);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                        sel && !broadcast
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      <User className="h-3.5 w-3.5" /> {d.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active transfers */}
          {transfers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Transfers
              </h3>
              {transfers.map((t) => {
                const pct =
                  t.totalBytes > 0
                    ? Math.round((t.uploadedBytes / t.totalBytes) * 100)
                    : 0;
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border bg-card p-3 animate-slide-up"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {t.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-[var(--online)]" />
                        ) : t.status === "error" ? (
                          <X className="h-5 w-5 text-destructive" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-brand" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {t.fileName}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {t.status === "uploading"
                              ? `${pct}%`
                              : t.status === "completed"
                              ? "Done"
                              : "Failed"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={pct} className="h-1.5" />
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {formatBytes(t.uploadedBytes)} /{" "}
                            {formatBytes(t.totalBytes)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          → {t.recipientLabel}
                        </p>
                      </div>
                      {t.status === "uploading" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => cancelTransfer(t.id)}
                          title="Cancel upload"
                          aria-label="Cancel upload"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* File history */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                File history
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshFiles}
                className="h-7 text-xs"
              >
                Refresh
              </Button>
            </div>
            {files.length > 0 && (
              <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {([
                    ["all", "All"],
                    ["image", "Images"],
                    ["doc", "Docs"],
                    ["video", "Videos"],
                    ["other", "Other"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTypeFilter(key)}
                      className={cn(
                        "h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors",
                        typeFilter === key
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-background text-muted-foreground hover:bg-muted border-border"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Sort control */}
                <div className="flex items-center gap-0.5 text-[11px]">
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground mr-1" />
                  {(["date", "name", "size"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSortBy(key)}
                      className={cn(
                        "h-6 px-2 rounded-md font-medium transition-colors capitalize",
                        sortBy === key
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {files.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <FileIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium">No files yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shared files will appear here for re-download.
                </p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center">
                <p className="text-sm font-medium">No files match this filter</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Try a different category.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredFiles.map((f) => (
                  <FileCard
                    key={f.id}
                    file={f}
                    mine={f.senderId === self?.deviceId}
                    previewEnabled={previewEnabled}
                    onDownload={() => handleDownload(f)}
                    onDelete={() => handleDelete(f.id)}
                    onPreview={() => setPreviewFile(f)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Preview dialog */}
      <Dialog
        open={!!previewFile}
        onOpenChange={(o) => !o && setPreviewFile(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewFile?.originalName}
            </DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-3">
              {isImageMime(previewFile.mimeType) ? (
                <div className="flex items-center justify-center bg-muted/40 rounded-lg p-2 min-h-[200px]">
                <img
                  src={`/api/download/${previewFile.id}`}
                    alt={previewFile.originalName}
                    className="max-h-[60vh] max-w-full object-contain rounded"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>{formatBytes(previewFile.size)}</p>
                  <p>
                    From {previewFile.senderName} · {relativeTime(previewFile.createdAt)}
                  </p>
                </div>
                <Button
                  onClick={() => handleDownload(previewFile)}
                  className="bg-brand hover:bg-brand/90 text-brand-foreground"
                >
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileCard({
  file,
  mine,
  previewEnabled,
  onDownload,
  onDelete,
  onPreview,
}: {
  file: FileRecord;
  mine: boolean;
  previewEnabled: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const kind = fileKind(file.mimeType, file.extension);
  const Icon = ICONS[kind.icon] || FileIcon;
  const canPreview = previewEnabled && isPreviewable(file.mimeType);
  const recipientLabel = file.isBroadcast
    ? "Everyone"
    : "Selected devices";

  return (
    <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail / icon area — full-bleed image for images, icon for others */}
      <button
        onClick={canPreview ? onPreview : onDownload}
        className="relative block w-full h-24 bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center hover:brightness-95 transition-all overflow-hidden"
        title={canPreview ? "Preview" : "Download"}
      >
        <FileThumbnail
          fileId={file.id}
          isImage={isImageMime(file.mimeType)}
          isVideo={/^video\//.test(file.mimeType)}
          Icon={Icon}
        />
      </button>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={file.originalName}>
              {file.originalName}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-[11px] text-muted-foreground">
                {formatBytes(file.size)}
              </span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">
                {mine ? "You" : file.senderName}
              </span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">
                {relativeTime(file.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge
                variant="secondary"
                className="text-[10px] h-5 gap-1 font-normal"
              >
                {file.isBroadcast ? (
                  <Users className="h-2.5 w-2.5" />
                ) : (
                  <User className="h-2.5 w-2.5" />
                )}
                {recipientLabel}
              </Badge>
              {file.downloadCount > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 font-normal">
                  <Download className="h-2.5 w-2.5 mr-1" />
                  {file.downloadCount}×
                </Badge>
              )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" /> Download
            </DropdownMenuItem>
            {canPreview && (
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="mr-2 h-4 w-4" /> Preview
              </DropdownMenuItem>
            )}
            {mine && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// Renders a thumbnail: image files lazy-load the actual image; video files
// capture a frame via a <video> + <canvas> (browser-side, no ffmpeg needed);
// other types fall back to the file-type icon.
function FileThumbnail({
  fileId,
  isImage,
  isVideo,
  Icon,
}: {
  fileId: string;
  isImage: boolean;
  isVideo: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  if (isImage) {
    return <ImageThumbnail fileId={fileId} Icon={Icon} />;
  }
  if (isVideo) {
    return <VideoThumbnail fileId={fileId} Icon={Icon} />;
  }
  return <Icon className="h-8 w-8 text-muted-foreground" />;
}

function ImageThumbnail({
  fileId,
  Icon,
}: {
  fileId: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <Icon className="h-8 w-8 text-muted-foreground" />;
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={`/api/download/${fileId}`}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setErrored(true);
          setLoaded(true);
        }}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </>
  );
}

// Captures a single frame from a video file using a hidden <video> element
// + a <canvas>. The frame is rendered as a data URL thumbnail. Falls back
// to the film icon on any error. A play badge overlays the thumbnail so the
// user knows it's a video.
function VideoThumbnail({
  fileId,
  Icon,
}: {
  fileId: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (thumb || failed) return;
    const video = document.createElement("video");
    videoRef.current = video;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    video.src = `/api/download/${fileId}`;

    const onLoaded = () => {
      // Seek to ~10% in or 1s, whichever is smaller, to get a representative frame.
      const target = Math.min(1, (video.duration || 2) * 0.1);
      video.currentTime = isFinite(target) ? target : 0;
    };
    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setFailed(true);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumb(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        setFailed(true);
      }
    };
    const onError = () => setFailed(true);

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    // Some browsers need a play() to decode the frame.
    void video.play().then(() => video.pause()).catch(() => {});

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.src = "";
    };
  }, [fileId, thumb, failed]);

  if (failed) {
    return <Icon className="h-8 w-8 text-muted-foreground" />;
  }

  if (!thumb) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <img
        src={thumb}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Play badge overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4 ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </>
  );
}
