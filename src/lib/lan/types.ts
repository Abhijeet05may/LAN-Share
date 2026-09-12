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

export type ConversationId = "group" | string; // "group" or a peer deviceId
