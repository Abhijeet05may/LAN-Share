"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Send, Lock, Users, Search, X, ArrowDown, Trash2, Pencil, Check, CheckCheck, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceAvatar } from "./DeviceAvatar";
import { EmojiPicker } from "@/components/lan/EmojiPicker";
import { useLanStore } from "@/lib/lan/store";
import { lanSocket } from "@/lib/lan/socketManager";
import { clockTime, initialsOf } from "@/lib/lan/device";
import type { ChatMessage } from "@/lib/lan/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatPanelProps {
  conversationId: "group" | string;
  peerName?: string;
  peerColor?: string;
  peerDeviceType?: "desktop" | "tablet" | "mobile";
  peerOnline?: boolean;
}

export function ChatPanel({
  conversationId,
  peerName,
  peerColor,
  peerDeviceType,
  peerOnline,
}: ChatPanelProps) {
  const self = useLanStore((s) => s.self);
  const groupMessages = useLanStore((s) => s.groupMessages);
  const privateMessages = useLanStore((s) => s.privateMessages);
  const setGroupMessages = useLanStore((s) => s.setGroupMessages);
  const setPrivateMessages = useLanStore((s) => s.setPrivateMessages);
  const typing = useLanStore((s) => s.typing);
  const addMessage = useLanStore((s) => s.addMessage);
  const removeMessage = useLanStore((s) => s.removeMessage);
  const updateMessage = useLanStore((s) => s.updateMessage);
  const clearUnread = useLanStore((s) => s.clearUnread);
  const publicSettings = useLanStore((s) => s.publicSettings);
  const mutedConversations = useLanStore((s) => s.mutedConversations);
  const toggleConversationMuted = useLanStore((s) => s.toggleConversationMuted);

  const isGroup = conversationId === "group";
  const [input, setInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSent = useRef(0);
  const loadedRef = useRef(false);

  const maxLen = publicSettings.maxMessageLength;
  const typingEnabled = publicSettings.typingIndicator;

  const messages = useMemo<ChatMessage[]>(() => {
    return isGroup ? groupMessages : privateMessages[conversationId] || [];
  }, [isGroup, groupMessages, privateMessages, conversationId]);

  const filteredMessages = useMemo<ChatMessage[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // Load history once per conversation.
  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    (async () => {
      try {
        const url = isGroup
          ? "/api/messages?deviceId=" +
            encodeURIComponent(self?.deviceId || "") +
            "&type=group"
          : "/api/messages?deviceId=" +
            encodeURIComponent(self?.deviceId || "") +
            "&type=private&peerId=" +
            encodeURIComponent(conversationId);
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const msgs: ChatMessage[] = data.messages || [];
        if (isGroup) setGroupMessages(msgs);
        else setPrivateMessages(conversationId, msgs);
      } catch {
        /* ignore */
      } finally {
        loadedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, isGroup]);

  // Auto-scroll on new messages (only if the user is already near the bottom).
  useEffect(() => {
    const el = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Track scroll position to show/hide the "jump to bottom" button.
  useEffect(() => {
    const el = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowJump(!nearBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  // Insert an emoji at the textarea cursor position.
  const insertEmoji = useCallback(
    (emoji: string) => {
      const ta = textareaRef.current;
      if (!ta) {
        setInput((prev) => prev + emoji);
        return;
      }
      const start = ta.selectionStart ?? input.length;
      const end = ta.selectionEnd ?? input.length;
      const next = input.slice(0, start) + emoji + input.slice(end);
      const clamped = maxLen > 0 ? next.slice(0, maxLen) : next;
      setInput(clamped);
      // Restore cursor just after the inserted emoji (after re-render).
      requestAnimationFrame(() => {
        const pos = start + emoji.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    },
    [input, maxLen]
  );

  // Clear unread when viewing.
  useEffect(() => {
    clearUnread(conversationId);
  }, [conversationId, clearUnread]);

  // Read receipts: mark incoming private messages as read when this
  // conversation is open + visible, and notify each sender via socket.
  useEffect(() => {
    if (!self || isGroup) return;
    const socket = lanSocket.get();
    const incoming = messages.filter(
      (m) =>
        m.senderId !== self.deviceId &&
        m.recipientId === self.deviceId &&
        !m.read
    );
    if (incoming.length === 0) return;
    // Mark them read locally.
    for (const m of incoming) {
      updateMessage(m.id, { read: true });
    }
    // Fire-and-forget: persist the read state + notify senders.
    for (const m of incoming) {
      if (socket?.connected) {
        socket.emit("chat:read-receipt", {
          id: m.id,
          readerId: self.deviceId,
          senderId: m.senderId,
        });
      }
      fetch(`/api/messages/${m.id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId: self.deviceId }),
      }).catch(() => {});
    }
  }, [self, isGroup, messages, updateMessage]);

  const typingEntries = typing[conversationId] || [];

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !self) return;
    const socket = lanSocket.get();
    if (!socket || !socket.connected) {
      toast.error("Not connected to the network");
      return;
    }
    const msg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId: self.deviceId,
      senderName: self.name,
      recipientId: isGroup ? null : conversationId,
      content: text,
      timestamp: new Date().toISOString(),
      read: false,
    };
    addMessage(msg);
    socket.emit("chat:message", {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      recipientId: msg.recipientId,
      content: msg.content,
      timestamp: msg.timestamp,
    });
    // Stop typing indicator for self (only if enabled).
    if (typingEnabled) {
      socket.emit("chat:typing", {
        senderId: self.deviceId,
        senderName: self.name,
        recipientId: isGroup ? null : conversationId,
        isTyping: false,
      });
    }
    setInput("");
  }, [input, self, isGroup, conversationId, addMessage, typingEnabled]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!self) return;
      // Optimistically remove from the local store.
      removeMessage(id);
      // Notify peers via socket (fire-and-forget; server is source of truth).
      const socket = lanSocket.get();
      if (socket?.connected) {
        socket.emit("chat:deleted", {
          id,
          senderId: self.deviceId,
          recipientId: isGroup ? null : conversationId,
        });
      }
      // Persist the deletion on the server.
      try {
        await fetch(
          `/api/messages/${id}?senderId=${encodeURIComponent(self.deviceId)}`,
          { method: "DELETE" }
        );
      } catch {
        /* non-fatal — the message is already removed locally */
      }
    },
    [self, isGroup, conversationId, removeMessage]
  );

  const handleEdit = useCallback(
    async (id: string, newContent: string) => {
      if (!self) return;
      const trimmed = newContent.trim();
      if (!trimmed) return;
      // Optimistically update the local store.
      updateMessage(id, { content: trimmed, edited: true });
      // Notify peers via socket (fire-and-forget).
      const socket = lanSocket.get();
      if (socket?.connected) {
        socket.emit("chat:edited", {
          id,
          senderId: self.deviceId,
          senderName: self.name,
          recipientId: isGroup ? null : conversationId,
          content: trimmed,
          timestamp: new Date().toISOString(),
        });
      }
      // Persist the edit on the server.
      try {
        await fetch(`/api/messages/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId: self.deviceId, content: trimmed }),
        });
      } catch {
        /* non-fatal — the message is already updated locally */
      }
    },
    [self, isGroup, conversationId, updateMessage]
  );

  const handleInput = (value: string) => {
    // Enforce client-side max message length (server also enforces).
    const clamped = maxLen > 0 ? value.slice(0, maxLen) : value;
    setInput(clamped);
    if (!self || !typingEnabled) return;
    const socket = lanSocket.get();
    if (!socket || !socket.connected) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 1500 && clamped.trim()) {
      lastTypingSent.current = now;
      socket.emit("chat:typing", {
        senderId: self.deviceId,
        senderName: self.name,
        recipientId: isGroup ? null : conversationId,
        isTyping: true,
      });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Muted indicator banner */}
      {mutedConversations.includes(conversationId) && (
        <div className="shrink-0 border-b bg-amber-500/10 px-3 py-1.5 flex items-center justify-center gap-1.5 animate-fade-in">
          <BellOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Notifications muted for this {isGroup ? "group chat" : "conversation"}
          </span>
        </div>
      )}
      {/* Search bar (collapsible) */}
      {searchOpen && (
        <div className="shrink-0 border-b bg-card/60 backdrop-blur-sm px-3 py-2 flex items-center gap-2 animate-slide-up">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isGroup ? "Search messages…" : `Search chat with ${peerName}…`
            }
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {filteredMessages.length}/{messages.length}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setSearchQuery("");
              setSearchOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {/* Messages */}
      <div className="relative flex-1 min-h-0">
      <ScrollArea ref={scrollRef} className="h-full scrollbar-thin">
        <div className="px-3 sm:px-5 py-4 space-y-1">
          {filteredMessages.length === 0 ? (
            searchQuery ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No matches</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different search term.
                </p>
              </div>
            ) : (
              <EmptyChat isGroup={isGroup} peerName={peerName} />
            )
          ) : (
            filteredMessages.map((m, i) => {
              const mine = m.senderId === self?.deviceId;
              const prev = filteredMessages[i - 1];
              const showHeader =
                !prev ||
                prev.senderId !== m.senderId ||
                new Date(m.timestamp).getTime() -
                  new Date(prev.timestamp).getTime() >
                  5 * 60 * 1000;
              // Date separator when the calendar day changes.
              const showDateSep =
                !prev ||
                new Date(prev.timestamp).toDateString() !==
                  new Date(m.timestamp).toDateString();
              return (
                <div key={m.id}>
                  {showDateSep && (
                    <DateSeparator timestamp={m.timestamp} />
                  )}
                  <MessageBubble
                    msg={m}
                    mine={mine}
                    showHeader={showHeader}
                    isGroup={isGroup}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                </div>
              );
            })
          )}
          {typingEnabled && typingEntries.length > 0 && (
            <TypingIndicator entries={typingEntries} />
          )}
        </div>
      </ScrollArea>
      {/* Jump to bottom button */}
      {showJump && (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-card border shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform animate-fade-in z-10"
          aria-label="Jump to latest"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
      </div>

      {/* Input */}
      <div className="border-t bg-card/60 backdrop-blur-sm p-3">
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search messages"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => toggleConversationMuted(conversationId)}
            aria-label={mutedConversations.includes(conversationId) ? "Unmute conversation" : "Mute conversation"}
            title={mutedConversations.includes(conversationId) ? "Unmute notifications" : "Mute notifications"}
          >
            {mutedConversations.includes(conversationId) ? (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
          </Button>
          <EmojiPicker onPick={insertEmoji} />
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                isGroup ? "Message everyone…" : `Message ${peerName}…`
              }
              rows={1}
              className="min-h-[44px] max-h-32 resize-none py-3 px-3.5 text-sm leading-relaxed"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0 bg-brand hover:bg-brand/90 text-brand-foreground"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            {isGroup ? (
              <>
                <Users className="h-3 w-3" /> Visible to everyone
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" /> Private end-to-end on this network
              </>
            )}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {maxLen > 0 ? (
              <span className={input.length > maxLen * 0.9 ? "text-amber-500 font-medium" : ""}>
                {input.length}/{maxLen}
              </span>
            ) : (
              "Enter to send · Shift+Enter for newline"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  mine,
  showHeader,
  isGroup,
  onDelete,
  onEdit,
}: {
  msg: ChatMessage;
  mine: boolean;
  showHeader: boolean;
  isGroup: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Focus + auto-size the textarea when entering edit mode.
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = "auto";
      editRef.current.style.height = `${editRef.current.scrollHeight}px`;
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(msg.content);
    setEditing(true);
    setConfirming(false);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== msg.content && onEdit) {
      onEdit(msg.id, trimmed);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(msg.content);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group/msg flex gap-2.5 animate-fade-in",
        mine ? "flex-row-reverse" : "flex-row",
        showHeader ? "mt-3" : "mt-0.5"
      )}
    >
      {/* Avatar (others only, shown on header rows) */}
      <div className="w-8 shrink-0 self-end">
        {!mine && showHeader && (
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm"
            style={{
              backgroundColor: hashColor(msg.senderId + msg.senderName),
            }}
          >
            {initialsOf(msg.senderName)}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col max-w-[78%] sm:max-w-[68%]",
          mine ? "items-end" : "items-start"
        )}
      >
        {showHeader && (
          <div
            className={cn(
              "flex items-center gap-2 px-1 mb-0.5",
              mine && "flex-row-reverse"
            )}
          >
            <span className="text-xs font-semibold truncate max-w-[160px]">
              {mine ? "You" : msg.senderName}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {clockTime(msg.timestamp)}
            </span>
            {msg.edited && (
              <span className="text-[9px] italic text-muted-foreground/80">
                edited
              </span>
            )}
          </div>
        )}
        <div className={cn("flex items-end gap-1", mine && "flex-row-reverse")}>
          {editing ? (
            <div
              className={cn(
                "rounded-2xl px-3 py-2 shadow-sm flex flex-col gap-1.5 min-w-[200px] animate-fade-in",
                mine
                  ? "bg-brand text-brand-foreground rounded-br-md"
                  : "bg-card border rounded-bl-md"
              )}
            >
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                className={cn(
                  "bg-transparent text-sm leading-relaxed resize-none outline-none w-full min-h-[24px]",
                  mine ? "placeholder:text-brand-foreground/60" : "placeholder:text-muted-foreground"
                )}
                rows={1}
              />
              <div className={cn("flex items-center justify-end gap-1", mine && "flex-row-reverse")}>
                <button
                  onClick={saveEdit}
                  className="h-6 px-2 rounded-md text-[10px] font-medium bg-brand-foreground/20 hover:bg-brand-foreground/30 transition-colors flex items-center gap-1"
                  title="Save (Enter)"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="h-6 w-6 rounded-md hover:bg-brand-foreground/15 transition-colors flex items-center justify-center"
                  title="Cancel (Esc)"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2 text-sm break-words shadow-sm",
                  mine
                    ? "bg-brand text-brand-foreground rounded-br-md"
                    : "bg-card border rounded-bl-md"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
              {/* Read receipt: "seen" checkmark on my private messages once read */}
              {mine && !isGroup && msg.read && (
                <span className={cn("flex items-center gap-0.5 text-[9px] text-muted-foreground animate-fade-in", mine ? "self-end pr-1" : "self-start pl-1")}>
                  <CheckCheck className="h-3 w-3 text-[var(--online)]" />
                  seen
                </span>
              )}
            </div>
          )}
          {/* Edit + Delete actions — only for the sender's own messages, revealed on hover (hidden while editing) */}
          {mine && !editing && (onDelete || onEdit) && (
            <div className="opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity pb-0.5">
              {confirming ? (
                <div className="flex items-center gap-0.5 animate-fade-in">
                  <button
                    onClick={() => {
                      onDelete?.(msg.id);
                      setConfirming(false);
                    }}
                    className="h-6 px-2 rounded-md text-[10px] font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
                    title="Confirm delete"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="h-6 w-6 rounded-md text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center"
                    title="Cancel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  {onEdit && (
                    <button
                      onClick={startEdit}
                      className="h-6 w-6 rounded-md text-muted-foreground hover:bg-muted hover:text-brand transition-colors flex items-center justify-center"
                      title="Edit message"
                      aria-label="Edit message"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => setConfirming(true)}
                      className="h-6 w-6 rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors flex items-center justify-center"
                      title="Delete message"
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({
  entries,
}: {
  entries: { senderId: string; senderName: string }[];
}) {
  const label =
    entries.length === 1
      ? `${entries[0].senderName} is typing`
      : entries.length === 2
      ? `${entries[0].senderName} and ${entries[1].senderName} are typing`
      : `${entries.length} people are typing`;
  return (
    <div className="flex items-center gap-2 px-2 py-1 animate-fade-in">
      <div className="flex gap-1 px-3 py-2 rounded-2xl bg-card border rounded-bl-md">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
      <span className="text-[11px] text-muted-foreground">{label}…</span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}

function EmptyChat({
  isGroup,
  peerName,
}: {
  isGroup: boolean;
  peerName?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-brand/15 text-brand flex items-center justify-center mb-4">
        {isGroup ? <Users className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
      </div>
      <h3 className="text-sm font-semibold">
        {isGroup ? "Group chat is empty" : `Start chatting with ${peerName}`}
      </h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
        {isGroup
          ? "Send the first message — everyone on the network will see it."
          : "Your messages here are private between the two of you."}
      </p>
    </div>
  );
}

function DateSeparator({ timestamp }: { timestamp: string | number | Date }) {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  let label: string;
  if (d.toDateString() === today.toDateString()) label = "Today";
  else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
  else
    label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  return (
    <div className="flex items-center gap-3 py-2 animate-fade-in">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// Simple stable color from a string (fallback when no avatar color known).
function hashColor(seed: string): string {
  const palette = [
    "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
    "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#a855f7",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return palette[Math.abs(hash) % palette.length];
}
