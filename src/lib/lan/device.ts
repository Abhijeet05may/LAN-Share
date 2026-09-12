import type { DeviceType } from "./types";

// Generate a stable per-browser device id, persisted in localStorage.
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "lan-share:deviceId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `dev_${cryptoRandom()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Detect device type from user agent.
export function detectDeviceType(ua: string = ""): DeviceType {
  const s = ua.toLowerCase();
  if (/tablet|ipad/.test(s)) return "tablet";
  if (/mobi|android|iphone|ipod|windows phone/.test(s)) return "mobile";
  return "desktop";
}

// Stable avatar color derived from a seed string (device id or name).
const AVATAR_PALETTE = [
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#a855f7", // purple
];

export function colorForSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// Auto-generate a friendly default display name like "Laptop-A1B2".
export function generateDefaultName(deviceType: DeviceType): string {
  const label =
    deviceType === "mobile" ? "Phone" : deviceType === "tablet" ? "Tablet" : "Laptop";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${label}-${suffix}`;
}

// Initials for avatars.
export function initialsOf(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s-_]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Human-readable file size.
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// Relative time like "2m ago".
export function relativeTime(iso: string | number | Date): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

// Clock time like "14:05".
export function clockTime(iso: string | number | Date): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Detect whether a mime type is previewable as an image.
export function isImageMime(mime: string): boolean {
  return /^image\//.test(mime);
}

export function isPdfMime(mime: string): boolean {
  return mime === "application/pdf";
}

export function isPreviewable(mime: string): boolean {
  return isImageMime(mime) || isPdfMime(mime);
}

// Icon name for a file based on mime/extension.
export function fileKind(mime: string, ext: string): {
  icon: string;
  label: string;
} {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (isImageMime(mime)) return { icon: "image", label: "Image" };
  if (isPdfMime(mime)) return { icon: "file-text", label: "PDF" };
  if (/^video\//.test(mime)) return { icon: "film", label: "Video" };
  if (/^audio\//.test(mime)) return { icon: "music", label: "Audio" };
  if (["zip", "rar", "7z", "tar", "gz"].includes(e)) return { icon: "archive", label: "Archive" };
  if (["js", "ts", "tsx", "jsx", "py", "java", "c", "cpp", "go", "rs", "json", "html", "css"].includes(e))
    return { icon: "code", label: "Code" };
  if (["doc", "docx"].includes(e)) return { icon: "file-text", label: "Document" };
  if (["xls", "xlsx", "csv"].includes(e)) return { icon: "sheet", label: "Spreadsheet" };
  return { icon: "file", label: "File" };
}
