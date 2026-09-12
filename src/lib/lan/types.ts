// Shared types for the LAN Share + Chat app.

export type DeviceType = "desktop" | "tablet" | "mobile";

export interface Device {
  deviceId: string;
  name: string;
  deviceType: DeviceType;
  avatarColor: string;
  userAgent?: string;
  online: boolean;
  socketId?: string;
  lastSeen?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string | null; // null => group chat
  content: string;
  timestamp: string;
  read?: boolean;
}

export interface FileRecord {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  extension: string;
  senderId: string;
  senderName: string;
  recipientIds: string; // csv
  isBroadcast: boolean;
  storagePath: string;
  status: "uploading" | "ready" | "expired" | "deleted";
  totalChunks: number;
  receivedChunks: number;
  expiresAt: string | null;
  downloadCount: number;
  createdAt: string;
}

export interface ActiveTransfer {
  id: string; // matches file id or temp id
  fileName: string;
  fileSize: number;
  mimeType: string;
  senderName: string;
  uploadedBytes: number;
  totalBytes: number;
  status: "uploading" | "completed" | "error";
  recipientLabel: string;
  startedAt: number;
}

export interface NetworkInfo {
  url: string;
  host: string;
  port: number;
  qrCodeDataUrl: string | null;
}

// Subset of admin settings exposed (unauthenticated) to clients so the UI can
// adapt live to admin changes (e.g. hide chat when disabled).
export interface PublicSettings {
  appName: string;
  roomName: string;
  themeDefault: "light" | "dark" | "system";
  qrVisible: boolean;
  pinEnabled: boolean;
  groupChatEnabled: boolean;
  privateChatEnabled: boolean;
  typingIndicator: boolean;
  filePreviewEnabled: boolean;
  maxFileBytes: number; // 0 = unlimited
  maxMessageLength: number; // 0 = unlimited
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  appName: "LAN Share",
  roomName: "Local Network",
  themeDefault: "system",
  qrVisible: true,
  pinEnabled: false,
  groupChatEnabled: true,
  privateChatEnabled: true,
  typingIndicator: true,
  filePreviewEnabled: true,
  maxFileBytes: 0,
  maxMessageLength: 0,
};

export type ConversationId = "group" | string; // "group" or a peer deviceId
