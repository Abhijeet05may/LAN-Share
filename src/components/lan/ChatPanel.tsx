"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Send, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceAvatar } from "./DeviceAvatar";
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
  const clearUnread = useLanStore((s) => s.clearUnread);

  const isGroup = conversationId === "group";
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);
  const loadedRef = useRef(false);

  const messages = useMemo<ChatMessage[]>(() => {
    return isGroup ? groupMessages : privateMessages[conversationId] || [];
  }, [isGroup, groupMessages, privateMessages, conversationId]);

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

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Clear unread when viewing.
  useEffect(() => {
    clearUnread(conversationId);
  }, [conversationId, clearUnread]);

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
    // Stop typing indicator for self.
    socket.emit("chat:typing", {
      senderId: self.deviceId,
      senderName: self.name,
      recipientId: isGroup ? null : conversationId,
      isTyping: false,
    });
    setInput("");
  }, [input, self, isGroup, conversationId, addMessage]);

  const handleInput = (value: string) => {
    setInput(value);
    if (!self) return;
    const socket = lanSocket.get();
    if (!socket || !socket.connected) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 1500 && value.trim()) {
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
      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 scrollbar-thin">
        <div className="px-3 sm:px-5 py-4 space-y-1">
          {messages.length === 0 ? (
            <EmptyChat isGroup={isGroup} peerName={peerName} />
          ) : (
            messages.map((m, i) => {
              const mine = m.senderId === self?.deviceId;
              const prev = messages[i - 1];
              const showHeader =
                !prev ||
                prev.senderId !== m.senderId ||
                new Date(m.timestamp).getTime() -
                  new Date(prev.timestamp).getTime() >
                  5 * 60 * 1000;
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  mine={mine}
                  showHeader={showHeader}
                  isGroup={isGroup}
                />
              );
            })
          )}
          {typingEntries.length > 0 && (
            <TypingIndicator entries={typingEntries} />
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-card/60 backdrop-blur-sm p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
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
          <span className="text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
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
}: {
  msg: ChatMessage;
  mine: boolean;
  showHeader: boolean;
  isGroup: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 animate-fade-in",
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
          </div>
        )}
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
