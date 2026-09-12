import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Settings keys + defaults
// ---------------------------------------------------------------------------
// All settings are stored as strings in the Setting table. Booleans are "true"/"false",
// numbers are their string form, lists are comma-separated.

export const DEFAULT_SETTINGS: Record<string, string> = {
  // General / Branding
  "app.name": "LAN Share",
  "theme.default": "system", // light | dark | system
  "network.roomName": "Local Network",

  // Network & Connection
  // network.port is display-only (changing requires a real restart; not applied live).
  "network.port": "3000",
  "network.pinEnabled": "false",
  "network.pin": "",
  "network.maxDevices": "0", // 0 = unlimited
  "network.qrVisible": "true",

  // File Sharing
  "files.maxSizeMB": "2048", // 0 = unlimited
  "files.extensionMode": "off", // off | whitelist | blacklist
  "files.extensionList": "",
  "files.storageQuotaMB": "0", // 0 = unlimited
  "files.autoDeleteMode": "never", // never | hours | afterDownload
  "files.autoDeleteHours": "24",
  "files.previewEnabled": "true",

  // Chat / Messaging
  "chat.groupEnabled": "true",
  "chat.privateEnabled": "true",
  "chat.historyMode": "forever", // forever | clearOnRestart | days
  "chat.historyDays": "30",
  "chat.maxMessageLength": "5000", // 0 = unlimited
  "chat.typingIndicator": "true",

  // Security & Access
  "security.maxUploadsPerMin": "0", // 0 = unlimited
  "security.maxMessagesPerMin": "0", // 0 = unlimited
  "security.adminInactivityMin": "30", // auto-logout after N minutes

  // Admin auth
  // Default password is "admin" (bcrypt-hashed on first boot). The UI urges
  // the admin to change it immediately.
  "admin.passwordHash": "", // bcrypt hash; empty => seed on first access
  "admin.passwordChanged": "false",
};

// ---------------------------------------------------------------------------
// In-process cache. Settings rarely change; a 5s TTL keeps reads fast while
// still picking up admin edits promptly. Cleared explicitly on update.
// ---------------------------------------------------------------------------

let cache: Record<string, string> | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5000;

export async function getAllSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  try {
    const rows = await db.setting.findMany();
    const merged: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) merged[r.key] = r.value;
    cache = merged;
    cacheAt = now;
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function getSetting(key: string): Promise<string> {
  const all = await getAllSettings();
  return all[key] ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  // Invalidate cache.
  cache = null;
}

export async function setSettings(updates: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  cache = null;
}

// Reset all settings back to defaults (used by the maintenance "reset" action).
export async function resetSettings(): Promise<void> {
  await db.setting.deleteMany({});
  cache = null;
}

// ---------------------------------------------------------------------------
// Typed accessors used by enforcement points.
// ---------------------------------------------------------------------------

export function toBool(v: string): boolean {
  return v === "true" || v === "1";
}

export function toInt(v: string, fallback = 0): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface PublicSettings {
  appName: string;
  roomName: string;
  themeDefault: string;
  qrVisible: boolean;
  pinEnabled: boolean;
  groupChatEnabled: boolean;
  privateChatEnabled: boolean;
  typingIndicator: boolean;
  filePreviewEnabled: boolean;
  maxFileBytes: number; // 0 = unlimited
  maxMessageLength: number; // 0 = unlimited
}

// The subset of settings exposed (unauthenticated) to clients so the UI can
// adapt live (e.g. hide chat when disabled). Never includes secrets.
export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await getAllSettings();
  const maxMB = toInt(s["files.maxSizeMB"], 0);
  return {
    appName: s["app.name"] || "LAN Share",
    roomName: s["network.roomName"] || "Local Network",
    themeDefault: s["theme.default"] || "system",
    qrVisible: toBool(s["network.qrVisible"]),
    pinEnabled: toBool(s["network.pinEnabled"]),
    groupChatEnabled: toBool(s["chat.groupEnabled"]),
    privateChatEnabled: toBool(s["chat.privateEnabled"]),
    typingIndicator: toBool(s["chat.typingIndicator"]),
    filePreviewEnabled: toBool(s["files.previewEnabled"]),
    maxFileBytes: maxMB > 0 ? maxMB * 1024 * 1024 : 0,
    maxMessageLength: toInt(s["chat.maxMessageLength"], 0),
  };
}

// File-extension validation against the configured whitelist/blacklist.
export function isExtensionAllowed(
  ext: string,
  mode: string,
  listCsv: string
): { allowed: boolean; reason?: string } {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (mode === "off" || !mode) return { allowed: true };
  const list = listCsv
    .split(",")
    .map((x) => x.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
  if (list.length === 0) return { allowed: true };
  if (mode === "whitelist") {
    return list.includes(e)
      ? { allowed: true }
      : { allowed: false, reason: `.${e} is not in the allowed list` };
  }
  if (mode === "blacklist") {
    return list.includes(e)
      ? { allowed: false, reason: `.${e} is blocked` }
      : { allowed: true };
  }
  return { allowed: true };
}
