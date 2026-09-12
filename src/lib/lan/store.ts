"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActiveTransfer,
  ChatMessage,
  ConversationId,
  Device,
  DeviceType,
  FileRecord,
  NetworkInfo,
  PublicSettings,
} from "./types";
import { DEFAULT_PUBLIC_SETTINGS } from "./types";

interface TypingEntry {
  senderId: string;
  senderName: string;
  at: number;
}

interface SelfProfile {
  deviceId: string;
  name: string;
  deviceType: DeviceType;
  avatarColor: string;
  onboarded: boolean;
  roomPin?: string; // the PIN the user entered during onboarding (if required)
}

interface LanState {
  // self
  self: SelfProfile | null;
  setSelf: (s: SelfProfile) => void;
  completeOnboarding: (s: SelfProfile) => void;

  // connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // devices
  devices: Device[];
  setDevices: (d: Device[]) => void;
  upsertDevice: (d: Device) => void;
  removeDevice: (deviceId: string) => void;

  // conversation
  activeConversation: ConversationId;
  setActiveConversation: (c: ConversationId) => void;

  // messages
  groupMessages: ChatMessage[];
  privateMessages: Record<string, ChatMessage[]>;
  addMessage: (m: ChatMessage) => void;
  removeMessage: (id: string) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setGroupMessages: (m: ChatMessage[]) => void;
  setPrivateMessages: (peerId: string, m: ChatMessage[]) => void;

  // unread
  unread: Record<string, number>;
  clearUnread: (c: ConversationId) => void;

  // typing
  typing: Record<string, TypingEntry[]>; // conversationId -> entries
  setTyping: (conversationId: string, senderId: string, senderName: string) => void;
  clearTyping: (conversationId: string, senderId: string) => void;

  // files
  files: FileRecord[];
  setFiles: (f: FileRecord[]) => void;
  addFile: (f: FileRecord) => void;
  updateFile: (id: string, patch: Partial<FileRecord>) => void;
  removeFile: (id: string) => void;

  // active transfers
  transfers: ActiveTransfer[];
  addTransfer: (t: ActiveTransfer) => void;
  updateTransfer: (id: string, patch: Partial<ActiveTransfer>) => void;
  removeTransfer: (id: string) => void;

  // network
  networkInfo: NetworkInfo | null;
  setNetworkInfo: (n: NetworkInfo | null) => void;

  // public settings (from /api/settings/public, updated live via socket)
  publicSettings: PublicSettings;
  setPublicSettings: (s: Partial<PublicSettings>) => void;

  // room pin (optional gate)
  roomPin: string;
  setRoomPin: (pin: string) => void;

  // sound notifications (persisted per-browser)
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;

  // per-conversation mute (persisted). Keyed by ConversationId ("group" or peer deviceId).
  mutedConversations: string[];
  toggleConversationMuted: (c: ConversationId) => void;

  // pinned conversations (persisted). Pinned ones sort to the top of the sidebar.
  pinnedConversations: string[];
  toggleConversationPinned: (c: ConversationId) => void;
}

export const useLanStore = create<LanState>()(
  persist(
    (set) => ({
      self: null,
      setSelf: (s) => set({ self: s }),
      completeOnboarding: (s) => set({ self: s }),

      connected: false,
      setConnected: (v) => set({ connected: v }),

      devices: [],
      setDevices: (d) => set({ devices: d }),
      upsertDevice: (d) =>
        set((st) => {
          const exists = st.devices.find((x) => x.deviceId === d.deviceId);
          if (exists) {
            return {
              devices: st.devices.map((x) =>
                x.deviceId === d.deviceId ? { ...x, ...d } : x
              ),
            };
          }
          return { devices: [...st.devices, d] };
        }),
      removeDevice: (deviceId) =>
        set((st) => ({
          devices: st.devices.filter((x) => x.deviceId !== deviceId),
        })),

      activeConversation: "group",
      setActiveConversation: (c) =>
        set((st) => ({
          activeConversation: c,
          unread: c !== "group" ? { ...st.unread, [c]: 0 } : st.unread,
        })),

      groupMessages: [],
      privateMessages: {},
      addMessage: (m) =>
        set((st) => {
          if (m.recipientId === null) {
            // group
            const exists = st.groupMessages.some((x) => x.id === m.id);
            if (exists) return {};
            const isActive = st.activeConversation === "group";
            const isSelf = m.senderId === st.self?.deviceId;
            return {
              groupMessages: [...st.groupMessages, m],
              unread: isActive || isSelf
                ? st.unread
                : { ...st.unread, group: (st.unread.group || 0) + 1 },
            };
          } else {
            // private: conversation id is the OTHER party
            const meId = st.self?.deviceId;
            const peerId = m.senderId === meId ? m.recipientId : m.senderId;
            const list = st.privateMessages[peerId] || [];
            if (list.some((x) => x.id === m.id)) return {};
            const isActive = st.activeConversation === peerId;
            const isSelf = m.senderId === meId;
            return {
              privateMessages: {
                ...st.privateMessages,
                [peerId]: [...list, m],
              },
              unread: isActive || isSelf
                ? st.unread
                : { ...st.unread, [peerId]: (st.unread[peerId] || 0) + 1 },
            };
          }
        }),
      removeMessage: (id: string) =>
        set((st) => ({
          groupMessages: st.groupMessages.filter((m) => m.id !== id),
          privateMessages: Object.fromEntries(
            Object.entries(st.privateMessages).map(([k, msgs]) => [
              k,
              msgs.filter((m) => m.id !== id),
            ])
          ),
        })),
      updateMessage: (id: string, patch: Partial<ChatMessage>) =>
        set((st) => ({
          groupMessages: st.groupMessages.map((m) =>
            m.id === id ? { ...m, ...patch } : m
          ),
          privateMessages: Object.fromEntries(
            Object.entries(st.privateMessages).map(([k, msgs]) => [
              k,
              msgs.map((m) => (m.id === id ? { ...m, ...patch } : m)),
            ])
          ),
        })),
      setGroupMessages: (m) => set({ groupMessages: m }),
      setPrivateMessages: (peerId, m) =>
        set((st) => ({
          privateMessages: { ...st.privateMessages, [peerId]: m },
        })),

      unread: {},
      clearUnread: (c) => set((st) => ({ unread: { ...st.unread, [c]: 0 } })),

      typing: {},
      setTyping: (conversationId, senderId, senderName) =>
        set((st) => {
          const list = (st.typing[conversationId] || []).filter(
            (t) => t.senderId !== senderId
          );
          return {
            typing: {
              ...st.typing,
              [conversationId]: [...list, { senderId, senderName, at: Date.now() }],
            },
          };
        }),
      clearTyping: (conversationId, senderId) =>
        set((st) => {
          const list = (st.typing[conversationId] || []).filter(
            (t) => t.senderId !== senderId
          );
          return {
            typing: { ...st.typing, [conversationId]: list },
          };
        }),

      files: [],
      setFiles: (f) => set({ files: f }),
      addFile: (f) =>
        set((st) => {
          const exists = st.files.some((x) => x.id === f.id);
          if (exists)
            return { files: st.files.map((x) => (x.id === f.id ? f : x)) };
          return { files: [f, ...st.files] };
        }),
      updateFile: (id, patch) =>
        set((st) => ({
          files: st.files.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeFile: (id) =>
        set((st) => ({ files: st.files.filter((x) => x.id !== id) })),

      transfers: [],
      addTransfer: (t) => set((st) => ({ transfers: [...st.transfers, t] })),
      updateTransfer: (id, patch) =>
        set((st) => ({
          transfers: st.transfers.map((x) =>
            x.id === id ? { ...x, ...patch } : x
          ),
        })),
      removeTransfer: (id) =>
        set((st) => ({ transfers: st.transfers.filter((x) => x.id !== id) })),

      networkInfo: null,
      setNetworkInfo: (n) => set({ networkInfo: n }),

      publicSettings: DEFAULT_PUBLIC_SETTINGS,
      setPublicSettings: (s) =>
        set((st) => ({ publicSettings: { ...st.publicSettings, ...s } })),

      roomPin: "",
      setRoomPin: (pin) => set({ roomPin: pin }),

      soundEnabled: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),

      mutedConversations: [],
      toggleConversationMuted: (c) =>
        set((st) => ({
          mutedConversations: st.mutedConversations.includes(c)
            ? st.mutedConversations.filter((x) => x !== c)
            : [...st.mutedConversations, c],
        })),

      pinnedConversations: [],
      toggleConversationPinned: (c) =>
        set((st) => ({
          pinnedConversations: st.pinnedConversations.includes(c)
            ? st.pinnedConversations.filter((x) => x !== c)
            : [...st.pinnedConversations, c],
        })),
    }),
    {
      name: "lan-share:store",
      partialize: (s) => ({
        self: s.self,
        roomPin: s.roomPin,
        soundEnabled: s.soundEnabled,
        mutedConversations: s.mutedConversations,
        pinnedConversations: s.pinnedConversations,
      }),
    }
  )
);
