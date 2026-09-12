"use client";

import { useMemo, useState } from "react";
import { Users, MessageCircle, Wifi, WifiOff, Crown, BellOff, FileUp, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DeviceAvatar } from "./DeviceAvatar";
import { useLanStore } from "@/lib/lan/store";
import { useFileUpload } from "@/lib/lan/useFileUpload";
import { clockTime } from "@/lib/lan/device";
import { toast } from "sonner";
import type { ConversationId } from "@/lib/lan/types";

interface DeviceListProps {
  onSelect?: (c: ConversationId) => void;
  className?: string;
}

export function DeviceList({ onSelect, className }: DeviceListProps) {
  const self = useLanStore((s) => s.self);
  const devices = useLanStore((s) => s.devices);
  const activeConversation = useLanStore((s) => s.activeConversation);
  const setActiveConversation = useLanStore((s) => s.setActiveConversation);
  const unread = useLanStore((s) => s.unread);
  const connected = useLanStore((s) => s.connected);
  const clearUnread = useLanStore((s) => s.clearUnread);
  const mutedConversations = useLanStore((s) => s.mutedConversations);
  const typing = useLanStore((s) => s.typing);
  const pinnedConversations = useLanStore((s) => s.pinnedConversations);
  const toggleConversationPinned = useLanStore((s) => s.toggleConversationPinned);
  const { uploadFiles } = useFileUpload();

  // Which device row is currently being dragged a file over (for highlight).
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const others = useMemo(
    () =>
      devices
        .filter((d) => d.deviceId !== self?.deviceId)
        .sort((a, b) => {
          // Pinned conversations sort to the top.
          const aPinned = pinnedConversations.includes(a.deviceId) ? 0 : 1;
          const bPinned = pinnedConversations.includes(b.deviceId) ? 0 : 1;
          if (aPinned !== bPinned) return aPinned - bPinned;
          // Then online before offline.
          return Number(b.online) - Number(a.online);
        }),
    [devices, self?.deviceId, pinnedConversations]
  );

  const onlineCount = devices.filter((d) => d.online).length;
  const groupUnread = unread.group || 0;

  const openConversation = (c: ConversationId) => {
    setActiveConversation(c);
    clearUnread(c);
    onSelect?.(c);
  };

  return (
    <div className={cn("flex flex-col h-full bg-sidebar", className)}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand text-brand-foreground flex items-center justify-center">
              <Wifi className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">LAN Share</h2>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {connected ? (
                  <span className="text-[var(--online)]">● Connected</span>
                ) : (
                  <span className="text-muted-foreground">○ Connecting…</span>
                )}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-medium">
            {onlineCount} online
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Self card */}
      {self && (
        <div className="px-3 py-3">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-2.5 border border-sidebar-border">
            <DeviceAvatar
              name={self.name}
              color={self.avatarColor}
              deviceType={self.deviceType}
              online={connected}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold truncate">{self.name}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Crown className="h-2.5 w-2.5" /> you
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground capitalize">
                This {self.deviceType}
              </span>
            </div>
          </div>
        </div>
      )}

      <Separator />

      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="px-2 py-2 space-y-0.5">
          {/* Group chat entry (also a drop target for "send to everyone") */}
          <ConversationRow
            active={activeConversation === "group"}
            onClick={() => openConversation("group")}
            icon={<MessageCircle className="h-4 w-4" />}
            title="Group Chat"
            subtitle="Everyone on the network"
            unread={groupUnread}
            muted={mutedConversations.includes("group")}
            accent
            draggable
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              if (dropTargetId !== "group") setDropTargetId("group");
            }}
            onDragLeave={() => {
              if (dropTargetId === "group") setDropTargetId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDropTargetId(null);
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                toast.success("Sending to everyone…");
                void uploadFiles(files, {
                  recipientIds: [],
                  isBroadcast: true,
                  recipientLabel: "Everyone",
                });
              }
            }}
            dropActive={dropTargetId === "group"}
            pinned={pinnedConversations.includes("group")}
            onTogglePin={() => toggleConversationPinned("group")}
          />

          <div className="px-2 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Devices
            </span>
            <span className="text-[11px] text-muted-foreground">{others.length}</span>
          </div>

          {others.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No other devices yet</p>
              <p className="text-xs text-muted-foreground mt-1 px-2">
                Open the host URL on another device to join.
              </p>
            </div>
          ) : (
            others.map((d) => {
              const convUnread = unread[d.deviceId] || 0;
              const isActive = activeConversation === d.deviceId;
              return (
                <ConversationRow
                  key={d.deviceId}
                  active={isActive}
                  onClick={() => openConversation(d.deviceId)}
                  avatar={
                    <DeviceAvatar
                      name={d.name}
                      color={d.avatarColor}
                      deviceType={d.deviceType}
                      online={d.online}
                      size="md"
                    />
                  }
                  title={d.name}
                  subtitle={
                    typing[d.deviceId]?.length
                      ? "typing…"
                      : d.online
                      ? `Online · ${d.deviceType}`
                      : d.lastSeen
                      ? `Last seen ${clockTime(d.lastSeen)}`
                      : "Offline"
                  }
                  typing={!!typing[d.deviceId]?.length}
                  unread={convUnread}
                  muted={mutedConversations.includes(d.deviceId)}
                  draggable
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (dropTargetId !== d.deviceId) setDropTargetId(d.deviceId);
                  }}
                  onDragLeave={() => {
                    if (dropTargetId === d.deviceId) setDropTargetId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTargetId(null);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      toast.success(`Sending to ${d.name}…`);
                      void uploadFiles(files, {
                        recipientIds: [d.deviceId],
                        isBroadcast: false,
                        recipientLabel: d.name,
                      });
                    }
                  }}
                  dropActive={dropTargetId === d.deviceId}
                  pinned={pinnedConversations.includes(d.deviceId)}
                  onTogglePin={() => toggleConversationPinned(d.deviceId)}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ConversationRow({
  active,
  onClick,
  icon,
  avatar,
  title,
  subtitle,
  unread,
  muted,
  accent,
  draggable,
  onDragOver,
  onDragLeave,
  onDrop,
  dropActive,
  pinned,
  onTogglePin,
  typing,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  avatar?: React.ReactNode;
  title: string;
  subtitle: string;
  unread?: number;
  muted?: boolean;
  typing?: boolean;
  accent?: boolean;
  draggable?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  dropActive?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      draggable={draggable}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors group relative",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/60",
        dropActive &&
          "ring-2 ring-brand bg-brand/10 outline-none"
      )}
    >
      {avatar ? (
        avatar
      ) : (
        <div
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
            accent
              ? "bg-brand/15 text-brand"
              : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate flex items-center gap-1.5">
            {title}
            {muted && (
              <BellOff className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            )}
          </span>
          {dropActive ? (
            <FileUp className="h-4 w-4 text-brand shrink-0 animate-fade-in" />
          ) : unread ? (
            <Badge
              className={cn(
                "h-5 min-w-5 px-1.5 text-[11px] flex items-center justify-center",
                muted
                  ? "bg-muted text-muted-foreground"
                  : "bg-brand text-brand-foreground"
              )}
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </div>
        <p
          className={cn(
            "text-[11px] truncate flex items-center gap-1",
            typing ? "text-brand font-medium" : "text-muted-foreground"
          )}
        >
          {dropActive ? "Drop to send file" : typing ? (
            <>
              <span className="inline-flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-brand animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1 w-1 rounded-full bg-brand animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1 w-1 rounded-full bg-brand animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              {subtitle}
            </>
          ) : subtitle}
        </p>
      </div>
      {/* Pin toggle — always visible when pinned, hover-revealed otherwise */}
      {onTogglePin && !dropActive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center shrink-0 transition-all",
            pinned
              ? "opacity-100 text-brand"
              : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-brand hover:bg-muted"
          )}
          title={pinned ? "Unpin" : "Pin to top"}
          aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
        >
          {pinned ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </button>
  );
}
