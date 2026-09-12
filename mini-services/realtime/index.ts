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
  ip: string;
  joinedAt: number;
}

interface DevicePublic {
  deviceId: string;
  name: string;
  deviceType: string;
  avatarColor?: string;
  online: boolean;
  socketId: string;
  ip: string;
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
const INTERNAL_PORT = 3004; // separate HTTP server for admin/internal endpoints
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
    ip: session.ip || "",
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

/**
 * Resolve the client's remote IP. Honors X-Forwarded-For (first IP) when set,
 * otherwise falls back to socket.handshake.address.
 */
function resolveClientIp(socket: Socket): string {
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim().length > 0) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).trim();
  }
  return socket.handshake.address || "";
}

/**
 * Check whether a device is on the admin's block list.
 * Fail-open: any network/parsing error returns {blocked:false} so a flaky
 * Next.js API never locks everyone out of the realtime service.
 */
async function isDeviceBlocked(
  deviceId: string,
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const res = await fetch("http://localhost:3000/api/blocked-devices");
    if (!res.ok) return { blocked: false };
    const data = await res.json();
    const found = (data.devices || []).find((d: any) => d.deviceId === deviceId);
    return found
      ? { blocked: true, reason: found.reason || "blocked" }
      : { blocked: false };
  } catch {
    return { blocked: false };
  }
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

// Internal HTTP request handler for admin endpoints (kick/broadcast/devices).
// Runs on a SEPARATE httpServer (port 3004) so socket.io's Engine.io — which
// intercepts ALL requests on the socket port (path "/") — doesn't race us.
async function internalHandler(req: any, res: any) {
  // CORS: server-to-server only, but allow any origin for safety.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (!req.url || !req.url.startsWith("/internal")) {
    res.statusCode = 404;
    res.end();
    return;
  }
  // Parse body for POST.
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const bodyRaw = Buffer.concat(chunks).toString("utf8");
  let body: any = {};
  try {
    body = bodyRaw ? JSON.parse(bodyRaw) : {};
  } catch {}

  try {
    if (req.method === "POST" && req.url === "/internal/kick") {
      const { deviceId, reason } = body;
      const sockId = deviceIdToSocket.get(deviceId);
      if (sockId) {
        io.to(sockId).emit("device:kicked", { reason: reason || "kicked" });
        const s = socketToSession.get(sockId);
        io.except(sockId).emit("device:left", { deviceId });
        const sock = io.sockets.sockets.get(sockId);
        if (sock) sock.disconnect(true);
        socketToSession.delete(sockId);
        deviceIdToSocket.delete(deviceId);
        broadcastDeviceList();
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, kicked: true }));
        log("internal/kick deviceId=" + deviceId);
      } else {
        res.statusCode = 200;
        res.end(
          JSON.stringify({ ok: true, kicked: false, reason: "not online" }),
        );
      }
      return;
    }
    if (req.method === "POST" && req.url === "/internal/broadcast") {
      const { event, payload } = body;
      if (event && typeof event === "string") {
        io.emit(event, payload ?? {});
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
        log("internal/broadcast event=" + event);
      } else {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "event required" }));
      }
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/internal/devices")) {
      const devices = Array.from(socketToSession.values()).map((s) => ({
        deviceId: s.deviceId,
        name: s.name,
        deviceType: s.deviceType,
        ip: s.ip || "",
        socketId: s.socketId,
      }));
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify({ devices }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  }
}

// socket.io server (port 3003) — Engine.io owns all HTTP on this port.
const httpServer = createServer();
const io = new Server(httpServer, {
  path: SOCKET_PATH,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Internal admin HTTP server (port 3004) — fully independent from socket.io.
const internalServer = createServer(internalHandler);

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

io.on("connection", (socket: Socket) => {
  log(`connect socket=${socket.id} online=${socketToSession.size}`);

  // -------------------------------------------------------------------------
  // device:join
  // -------------------------------------------------------------------------
  socket.on("device:join", async (payload: any) => {
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

      // Blocked-device check BEFORE registering the session (fail-open).
      const block = await isDeviceBlocked(deviceId);
      if (block.blocked) {
        socket.emit("device:kicked", {
          reason: "This device has been blocked by the admin",
        });
        socket.disconnect(true);
        log(`device:join rejected (blocked) deviceId=${deviceId}`);
        return;
      }

      // Resolve client IP (honor X-Forwarded-For first IP when present).
      const ip = resolveClientIp(socket);

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
        ip,
        joinedAt: Date.now(),
      };
      socketToSession.set(socket.id, session);
      deviceIdToSocket.set(deviceId, socket.id);

      // Fire-and-forget: upsert device so IP + lastSeen are recorded in DB.
      // (The Next.js /api/devices route upserts; IP is also authoritative from
      // realtime's /internal/devices endpoint for live sessions.)
      fetch("http://localhost:3000/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deviceId,
          name,
          deviceType,
          userAgent,
          avatarColor,
          ip: session.ip,
        }),
      }).catch((err) =>
        log(`device upsert error: ${(err as Error)?.message ?? err}`),
      );

      // 1) Emit device:list to the joining socket (full current list).
      socket.emit("device:list", { devices: buildDeviceList() });

      // 2) Broadcast device:joined to all OTHER sockets.
      socket.broadcast.emit("device:joined", { device: publicDevice(session) });

      // 3) Broadcast updated device:list to everyone.
      broadcastDeviceList();

      log(
        `device:join deviceId=${deviceId} name=${name} type=${deviceType} ip=${ip} online=${socketToSession.size}`,
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

internalServer.listen(INTERNAL_PORT, HOST, () => {
  log(
    `Internal admin HTTP service listening on http://${HOST}:${INTERNAL_PORT}`,
  );
});

process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${(err as Error)?.message ?? err}`);
});
process.on("unhandledRejection", (err) => {
  log(`unhandledRejection: ${(err as Error)?.message ?? err}`);
});
