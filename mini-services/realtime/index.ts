/**
 * LAN File Share + Chat — Realtime Socket.io mini-service
 *
 * Task ID: 2-a
 *
 * Listens on port 3003, bound to 0.0.0.0.
 * Socket.io path is `/` (Caddy relies on this — do NOT change).
 * CORS: allow all origins (LAN app).
 *
 * Implements the socket event contracts documented in /home/z/my-project/worklog.md.
 */

import { createServer } from "http";
import { Server, type Socket } from "socket.io";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceSession {
  socketId: string;
  deviceId: string;
  name: string;
  deviceType: string;
  avatarColor?: string;
  userAgent?: string;
  joinedAt: number;
}

interface DevicePublic {
  deviceId: string;
  name: string;
  deviceType: string;
  avatarColor?: string;
  online: boolean;
  socketId: string;
}

// ---------------------------------------------------------------------------
// In-memory device registry
// ---------------------------------------------------------------------------

const socketToSession = new Map<string, DeviceSession>();
const deviceIdToSocket = new Map<string, string>();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = 3003;
const HOST = "0.0.0.0";
const SOCKET_PATH = "/"; // MUST stay "/" — Caddy depends on it
const MESSAGES_API = "http://localhost:3000/api/messages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ts(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[realtime] ${ts()} ${msg}`);
}

function publicDevice(session: DeviceSession): DevicePublic {
  return {
    deviceId: session.deviceId,
    name: session.name,
    deviceType: session.deviceType,
    avatarColor: session.avatarColor,
    online: true,
    socketId: session.socketId,
  };
}

function buildDeviceList(): DevicePublic[] {
  const devices: DevicePublic[] = [];
  for (const session of socketToSession.values()) {
    devices.push(publicDevice(session));
  }
  return devices;
}

function broadcastDeviceList(): void {
  io.emit("device:list", { devices: buildDeviceList() });
}

/**
 * Persist a chat message by POSTing to the Next.js API.
 * Non-blocking — never lets persistence failure break real-time delivery.
 */
async function persistMessage(payload: {
  senderId: string;
  senderName?: string;
  recipientId?: string | null;
  content: string;
}): Promise<void> {
  try {
    const res = await fetch(MESSAGES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId: payload.senderId,
        senderName: payload.senderName ?? "",
        recipientId: payload.recipientId ?? null,
        content: payload.content,
      }),
    });
    if (!res.ok) {
      log(`persistMessage non-ok response: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    log(`persistMessage error: ${(err as Error)?.message ?? err}`);
  }
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const httpServer = createServer();
const io = new Server(httpServer, {
  path: SOCKET_PATH,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

io.on("connection", (socket: Socket) => {
  log(`connect socket=${socket.id} online=${socketToSession.size}`);

  // -------------------------------------------------------------------------
  // device:join
  // -------------------------------------------------------------------------
  socket.on("device:join", (payload: any) => {
    try {
      if (!payload || typeof payload !== "object") {
        log("device:join malformed payload (not an object), ignoring");
        return;
      }
      const { deviceId, name, deviceType, userAgent, avatarColor } = payload;
      if (!deviceId || !name || !deviceType) {
        log(
          `device:join missing required fields: ${JSON.stringify(payload)}`,
        );
        return;
      }

      // Handle reconnect: same deviceId with a new socket.
      const existingSocketId = deviceIdToSocket.get(deviceId);
      if (existingSocketId && existingSocketId !== socket.id) {
        socketToSession.delete(existingSocketId);
        log(
          `device:join replacing stale session deviceId=${deviceId} oldSocket=${existingSocketId} newSocket=${socket.id}`,
        );
      }

      const session: DeviceSession = {
        socketId: socket.id,
        deviceId,
        name,
        deviceType,
        avatarColor,
        userAgent,
        joinedAt: Date.now(),
      };
      socketToSession.set(socket.id, session);
      deviceIdToSocket.set(deviceId, socket.id);

      // 1) Emit device:list to the joining socket (full current list).
      socket.emit("device:list", { devices: buildDeviceList() });

      // 2) Broadcast device:joined to all OTHER sockets.
      socket.broadcast.emit("device:joined", { device: publicDevice(session) });

      // 3) Broadcast updated device:list to everyone.
      broadcastDeviceList();

      log(
        `device:join deviceId=${deviceId} name=${name} type=${deviceType} online=${socketToSession.size}`,
      );
    } catch (err) {
      log(`device:join error: ${(err as Error)?.message ?? err}`);
    }
  });

  // -------------------------------------------------------------------------
  // chat:message
  // -------------------------------------------------------------------------
  socket.on("chat:message", (payload: any) => {
    try {
      if (!payload || typeof payload !== "object") {
        log("chat:message malformed payload (not an object), ignoring");
        return;
      }
      const { senderId, senderName, recipientId, content, timestamp } = payload;
      if (!senderId || typeof content !== "string") {
        log(
          `chat:message missing required fields (senderId/content): ${JSON.stringify(payload)}`,
        );
        return;
      }

      const messagePayload = {
        id: payload.id ?? `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        senderId,
        senderName: senderName ?? "",
        recipientId: recipientId ?? null,
        content,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
      };

      // Persist (non-blocking — don't await before relaying).
      void persistMessage(messagePayload);

      if (messagePayload.recipientId == null) {
        // Group message: emit to everyone.
        io.emit("chat:message", messagePayload);
      } else {
        // Private: emit to recipient's socket AND back to sender.
        const recipientSocketId = deviceIdToSocket.get(
          messagePayload.recipientId,
        );
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("chat:message", messagePayload);
        } else {
          log(
            `chat:message recipient offline deviceId=${messagePayload.recipientId}`,
          );
        }
        // Always echo back to sender so they see their own message.
        socket.emit("chat:message", messagePayload);
      }

      log(
        `chat:message from=${senderId} to=${messagePayload.recipientId ?? "group"} contentLen=${content.length}`,
      );
    } catch (err) {
      log(`chat:message error: ${(err as Error)?.message ?? err}`);
    }
  });

  // -------------------------------------------------------------------------
  // chat:typing
  // -------------------------------------------------------------------------
  socket.on("chat:typing", (payload: any) => {
    try {
      if (!payload || typeof payload !== "object") {
        log("chat:typing malformed payload (not an object), ignoring");
        return;
      }
      const { senderId, senderName, recipientId, isTyping } = payload;
      if (!senderId) {
        log(`chat:typing missing senderId: ${JSON.stringify(payload)}`);
        return;
      }
      const typingPayload = {
        senderId,
        senderName: senderName ?? "",
        recipientId: recipientId ?? null,
        isTyping: !!isTyping,
      };
      if (typingPayload.recipientId == null) {
        // Group: broadcast to all except sender.
        socket.broadcast.emit("chat:typing", typingPayload);
      } else {
        // Private: emit to recipient socket only.
        const recipientSocketId = deviceIdToSocket.get(
          typingPayload.recipientId,
        );
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("chat:typing", typingPayload);
        } else {
          log(
            `chat:typing recipient offline deviceId=${typingPayload.recipientId}`,
          );
        }
      }
    } catch (err) {
      log(`chat:typing error: ${(err as Error)?.message ?? err}`);
    }
  });

  // -------------------------------------------------------------------------
  // chat:read
  // -------------------------------------------------------------------------
  socket.on("chat:read", (payload: any) => {
    try {
      if (!payload || typeof payload !== "object") {
        log("chat:read malformed payload (not an object), ignoring");
        return;
      }
      const { recipientId } = payload;
      const session = socketToSession.get(socket.id);
      if (!session) {
        log("chat:read sender session not found, ignoring");
        return;
      }
      const readerId = session.deviceId;
      const readPayload = {
        readerId,
        recipientId: recipientId ?? null,
      };
      if (readPayload.recipientId == null) {
        // Group: broadcast to others.
        socket.broadcast.emit("chat:read", readPayload);
      } else {
        // Private: emit to peer (recipientId) socket.
        const peerSocketId = deviceIdToSocket.get(readPayload.recipientId);
        if (peerSocketId) {
          io.to(peerSocketId).emit("chat:read", readPayload);
        } else {
          log(`chat:read peer offline deviceId=${readPayload.recipientId}`);
        }
      }
    } catch (err) {
      log(`chat:read error: ${(err as Error)?.message ?? err}`);
    }
  });

  // -------------------------------------------------------------------------
  // file:sent
  // -------------------------------------------------------------------------
  socket.on("file:sent", (payload: any) => {
    try {
      if (!payload || typeof payload !== "object") {
        log("file:sent malformed payload (not an object), ignoring");
        return;
      }
      const { file, senderId, senderName } = payload;
      if (!file || !senderId) {
        log(
          `file:sent missing required fields (file/senderId): ${JSON.stringify(payload)}`,
        );
        return;
      }
      const isBroadcast = !!file.isBroadcast;
      const recipientIds: string[] = Array.isArray(file.recipientIds)
        ? file.recipientIds
        : [];

      if (isBroadcast) {
        // Emit to everyone EXCEPT sender.
        socket.broadcast.emit("file:sent", payload);
      } else {
        // Emit to each recipient socket (skip sender — they already know).
        for (const rid of recipientIds) {
          const rSocket = deviceIdToSocket.get(rid);
          if (rSocket) {
            io.to(rSocket).emit("file:sent", payload);
          } else {
            log(`file:sent recipient offline deviceId=${rid}`);
          }
        }
      }

      log(
        `file:sent from=${senderId} name=${senderName ?? ""} broadcast=${isBroadcast} recipients=${recipientIds.length}`,
      );
    } catch (err) {
      log(`file:sent error: ${(err as Error)?.message ?? err}`);
    }
  });

  // -------------------------------------------------------------------------
  // file:downloaded
  // -------------------------------------------------------------------------
  socket.on("file:downloaded", (payload: any) => {
    try {
      if (!payload || typeof payload !== "object") {
        log("file:downloaded malformed payload (not an object), ignoring");
        return;
      }
      const { fileId, downloaderId, downloaderName, senderId } = payload;
      if (!fileId || !downloaderId) {
        log(
          `file:downloaded missing required fields (fileId/downloaderId): ${JSON.stringify(payload)}`,
        );
        return;
      }
      // Client payload includes the file's senderId; route to that socket.
      if (!senderId) {
        log("file:downloaded missing senderId, cannot route");
        return;
      }
      const senderSocket = deviceIdToSocket.get(senderId);
      if (senderSocket) {
        io.to(senderSocket).emit("file:downloaded", {
          fileId,
          downloaderId,
          downloaderName: downloaderName ?? "",
        });
      } else {
        log(`file:downloaded sender offline deviceId=${senderId}`);
      }
    } catch (err) {
      log(`file:downloaded error: ${(err as Error)?.message ?? err}`);
    }
  });

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------
  socket.on("disconnect", (reason: string) => {
    const session = socketToSession.get(socket.id);
    socketToSession.delete(socket.id);
    let leftDeviceId: string | undefined;
    if (session) {
      // Only delete the deviceId mapping if it still points to THIS socket.
      // (A reconnect may have already replaced it with a new socketId.)
      if (deviceIdToSocket.get(session.deviceId) === socket.id) {
        deviceIdToSocket.delete(session.deviceId);
      }
      leftDeviceId = session.deviceId;
    }
    log(
      `disconnect socket=${socket.id} deviceId=${leftDeviceId ?? "unknown"} reason=${reason} online=${socketToSession.size}`,
    );
    if (leftDeviceId) {
      io.emit("device:left", { deviceId: leftDeviceId });
      broadcastDeviceList();
    }
  });

  // -------------------------------------------------------------------------
  // error
  // -------------------------------------------------------------------------
  socket.on("error", (err: any) => {
    log(`socket error socket=${socket.id}: ${(err as Error)?.message ?? err}`);
  });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

httpServer.listen(PORT, HOST, () => {
  log(
    `Socket.io realtime service listening on http://${HOST}:${PORT} (path="${SOCKET_PATH}")`,
  );
});

process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${(err as Error)?.message ?? err}`);
});
process.on("unhandledRejection", (err) => {
  log(`unhandledRejection: ${(err as Error)?.message ?? err}`);
});
