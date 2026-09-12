"use client";

import { useEffect } from "react";
import { lanSocket } from "./socketManager";
import { useLanStore } from "./store";
import type { ChatMessage, Device, FileRecord } from "./types";

// Mounts the socket connection and wires all realtime events to the store.
// Should be rendered once, high in the tree, only after onboarding is complete.
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const self = useLanStore((s) => s.self);
  const setConnected = useLanStore((s) => s.setConnected);
  const setDevices = useLanStore((s) => s.setDevices);
  const upsertDevice = useLanStore((s) => s.upsertDevice);
  const removeDevice = useLanStore((s) => s.removeDevice);
  const addMessage = useLanStore((s) => s.addMessage);
  const setTyping = useLanStore((s) => s.setTyping);
  const clearTyping = useLanStore((s) => s.clearTyping);
  const addFile = useLanStore((s) => s.addFile);
  const updateFile = useLanStore((s) => s.updateFile);

  useEffect(() => {
    if (!self) return;

    const socket = lanSocket.connect();
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const onConnect = () => {
      setConnected(true);
      socket.emit("device:join", {
        deviceId: self.deviceId,
        name: self.name,
        deviceType: self.deviceType,
        userAgent: navigator.userAgent,
        avatarColor: self.avatarColor,
      });
    };

    const onDisconnect = () => setConnected(false);

    const onDeviceList = (data: { devices: Device[] }) => {
      setDevices(data.devices || []);
    };
    const onDeviceJoined = (data: { device: Device }) => {
      if (data?.device) upsertDevice(data.device);
    };
    const onDeviceLeft = (data: { deviceId: string }) => {
      if (data?.deviceId) removeDevice(data.deviceId);
    };

    const onChatMessage = (msg: ChatMessage) => {
      if (!msg) return;
      addMessage(msg);
      const isMine = msg.senderId === self.deviceId;
      if (!isMine && typeof document !== "undefined" && document.hidden) {
        try {
          if (Notification.permission === "granted") {
            new Notification(
              `${msg.recipientId ? "Private" : "Group"} · ${msg.senderName}`,
              { body: msg.content }
            );
          }
        } catch {
          /* ignore */
        }
      }
    };

    const onChatTyping = (data: {
      senderId: string;
      senderName: string;
      recipientId: string | null;
      isTyping: boolean;
    }) => {
      if (!data || data.senderId === self.deviceId) return;
      const conversationId =
        data.recipientId === null
          ? "group"
          : data.recipientId === self.deviceId
          ? data.senderId
          : data.recipientId;
      if (data.isTyping) {
        setTyping(conversationId, data.senderId, data.senderName);
        const key = `${conversationId}:${data.senderId}`;
        clearTimeout(typingTimers.get(key));
        typingTimers.set(
          key,
          setTimeout(() => clearTyping(conversationId, data.senderId), 4000)
        );
      } else {
        clearTyping(conversationId, data.senderId);
      }
    };

    const onFileSent = (data: {
      file: FileRecord;
      senderId: string;
      senderName: string;
    }) => {
      if (data?.file) addFile(data.file);
    };

    const onFileDownloaded = (data: {
      fileId: string;
      downloaderId: string;
      downloaderName: string;
    }) => {
      if (data?.fileId) updateFile(data.fileId, {});
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("device:list", onDeviceList);
    socket.on("device:joined", onDeviceJoined);
    socket.on("device:left", onDeviceLeft);
    socket.on("chat:message", onChatMessage);
    socket.on("chat:typing", onChatTyping);
    socket.on("file:sent", onFileSent);
    socket.on("file:downloaded", onFileDownloaded);

    // Request notification permission (best-effort).
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    // If already connected (HMR / re-mount), re-join immediately.
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("device:list", onDeviceList);
      socket.off("device:joined", onDeviceJoined);
      socket.off("device:left", onDeviceLeft);
      socket.off("chat:message", onChatMessage);
      socket.off("chat:typing", onChatTyping);
      socket.off("file:sent", onFileSent);
      socket.off("file:downloaded", onFileDownloaded);
      typingTimers.forEach((t) => clearTimeout(t));
      typingTimers.clear();
    };
  }, [self?.deviceId]);

  return <>{children}</>;
}
