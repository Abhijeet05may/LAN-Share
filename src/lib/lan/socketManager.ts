"use client";

import { io, Socket } from "socket.io-client";

// Singleton socket manager — the app mounts one provider that connects,
// and any component can import { lanSocket } to emit events.

const SOCKET_OPTS = {
  path: "/",
  transports: ["websocket", "polling"],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
};

class LanSocketManager {
  private socket: Socket | null = null;
  private listeners: Array<() => void> = [];

  connect(): Socket {
    if (this.socket) return this.socket;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    this.socket = io(`${origin}/?XTransformPort=3003`, SOCKET_OPTS);
    return this.socket;
  }

  get(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const lanSocket = new LanSocketManager();
