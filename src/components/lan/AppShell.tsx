"use client";

import { useState } from "react";
import {
  Wifi,
  MessageSquare,
  Files,
  Radio,
  Menu,
  LogOut,
  Users,
  ChevronLeft,
  Ban,
  ShieldOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "./ThemeToggle";
import { DeviceList } from "./DeviceList";
import { ChatPanel } from "./ChatPanel";
import { FileShare } from "./FileShare";
import { NetworkInfo } from "./NetworkInfo";
import { RealtimeProvider } from "@/lib/lan/RealtimeProvider";
import { useLanStore } from "@/lib/lan/store";
import { usePublicSettings } from "@/lib/lan/usePublicSettings";
import { toast } from "sonner";

type View = "chat" | "files" | "network";

export function AppShell() {
  return (
    <RealtimeProvider>
      <ShellInner />
    </RealtimeProvider>
  );
}

function ShellInner() {
  const self = useLanStore((s) => s.self);
  const setSelf = useLanStore((s) => s.setSelf);
  const connected = useLanStore((s) => s.connected);
  const devices = useLanStore((s) => s.devices);
  const activeConversation = useLanStore((s) => s.activeConversation);
  const setActiveConversation = useLanStore((s) => s.setActiveConversation);
  const unread = useLanStore((s) => s.unread);
  const publicSettings = useLanStore((s) => s.publicSettings);

  // Fetch public settings on mount + live-refetch on `settings:updated`.
  usePublicSettings();

  const [view, setView] = useState<View>("chat");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const selectConversation = (c: typeof activeConversation) => {
    setActiveConversation(c);
    setView("chat");
    setMobileSidebarOpen(false);
  };

  const peer =
    activeConversation !== "group"
      ? devices.find((d) => d.deviceId === activeConversation)
      : undefined;

  const onlineCount = devices.filter((d) => d.online).length;
  const totalUnread = Object.values(unread).reduce((a, b) => a + (b || 0), 0);
  const filesUnread = 0; // files don't carry unread; placeholder

  const handleSignOut = () => {
    setSelf({ ...self!, onboarded: false } as any);
    // Force a reload to reset socket + state cleanly.
    if (typeof window !== "undefined") window.location.reload();
  };

  const sidebar = <DeviceList onSelect={selectConversation} />;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top header */}
      <header className="shrink-0 border-b bg-card/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2 h-14 px-3 sm:px-4">
          {/* Mobile sidebar trigger */}
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9"
                aria-label="Open devices"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0">
              <div className="flex items-center justify-between px-3 h-12 border-b">
                <span className="text-sm font-semibold">Conversations</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="h-[calc(100%-3rem)]">{sidebar}</div>
            </SheetContent>
          </Sheet>

          {/* Brand */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-brand text-brand-foreground flex items-center justify-center shrink-0">
              <Wifi className="h-4 w-4" />
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">
                {publicSettings.appName}
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {connected ? (
                  <span className="text-[var(--online)]">
                    ● {onlineCount} online
                  </span>
                ) : (
                  <span>Connecting…</span>
                )}
              </p>
            </div>
          </div>

          {/* Conversation title (chat view) */}
          {view === "chat" && (
            <div className="flex-1 min-w-0 flex items-center justify-center">
              <div className="text-center min-w-0">
                <p className="text-sm font-medium truncate max-w-[50vw] sm:max-w-xs">
                  {activeConversation === "group"
                    ? "Group Chat"
                    : peer?.name || "Private Chat"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate flex items-center justify-center gap-1.5">
                  {activeConversation === "group" ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--online)] animate-pulse-dot" />
                        <span className="text-[var(--online)] font-medium tabular-nums">{onlineCount}</span>
                        <span>online</span>
                      </span>
                    </>
                  ) : peer?.online ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--online)] animate-pulse-dot" />
                      <span>Online</span>
                    </>
                  ) : (
                    "Offline"
                  )}
                </p>
              </div>
            </div>
          )}
          {view !== "chat" && <div className="flex-1" />}

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <SoundToggle />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleSignOut}
              title="Leave network"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-[300px] shrink-0 border-r">
          {sidebar}
        </aside>

        {/* Main view */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Desktop view tabs */}
          <div className="hidden lg:flex shrink-0 items-center gap-1 border-b bg-card/60 px-3 h-11">
            <ViewTab
              active={view === "chat"}
              onClick={() => setView("chat")}
              icon={<MessageSquare className="h-4 w-4" />}
              label="Chat"
              badge={totalUnread}
            />
            <ViewTab
              active={view === "files"}
              onClick={() => setView("files")}
              icon={<Files className="h-4 w-4" />}
              label="Files"
            />
            <ViewTab
              active={view === "network"}
              onClick={() => setView("network")}
              icon={<Radio className="h-4 w-4" />}
              label="Network"
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
          {view === "chat" ? (
            activeConversation === "group" ? (
              publicSettings.groupChatEnabled ? (
                <ChatPanel conversationId="group" />
              ) : (
                <ChatDisabled mode="group" />
              )
            ) : peer ? (
              publicSettings.privateChatEnabled ? (
                <ChatPanel
                  conversationId={peer.deviceId}
                  peerName={peer.name}
                  peerColor={peer.avatarColor}
                  peerDeviceType={peer.deviceType}
                  peerOnline={peer.online}
                />
              ) : (
                <ChatDisabled mode="private" peerName={peer.name} />
              )
            ) : (
              <EmptyPeer
                onBack={() => setActiveConversation("group")}
              />
            )
          ) : view === "files" ? (
            <FileShare />
          ) : (
            <NetworkInfo />
          )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden shrink-0 border-t bg-card/95 backdrop-blur-md z-20">
        <div className="grid grid-cols-3 h-14">
          <BottomTab
            active={view === "chat"}
            onClick={() => setView("chat")}
            icon={<MessageSquare className="h-5 w-5" />}
            label="Chat"
            badge={totalUnread}
          />
          <BottomTab
            active={view === "files"}
            onClick={() => setView("files")}
            icon={<Files className="h-5 w-5" />}
            label="Files"
            badge={filesUnread}
          />
          <BottomTab
            active={view === "network"}
            onClick={() => setView("network")}
            icon={<Radio className="h-5 w-5" />}
            label="Network"
          />
        </div>
      </nav>
    </div>
  );
}

function BottomTab({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 transition-colors",
        active ? "text-brand" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="relative">
        {icon}
        {badge ? (
          <span className="absolute -top-1.5 -right-2 bg-brand text-brand-foreground text-[9px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
      {active && (
        <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />
      )}
    </button>
  );
}

function EmptyPeer({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">This device went offline</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
        The conversation is saved. Pick another device from the sidebar to
        continue chatting.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onBack}>
        Back to group chat
      </Button>
    </div>
  );
}

function ChatDisabled({
  mode,
  peerName,
}: {
  mode: "group" | "private";
  peerName?: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        {mode === "group" ? (
          <Ban className="h-7 w-7 text-muted-foreground" />
        ) : (
          <ShieldOff className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-sm font-semibold">
        {mode === "group" ? "Group chat is disabled" : `Private chat with ${peerName} is disabled`}
      </h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
        An admin has turned off {mode === "group" ? "group" : "private"} messaging for this network. You can still share files and view the network info.
      </p>
    </div>
  );
}

function SoundToggle() {
  const soundEnabled = useLanStore((s) => s.soundEnabled);
  const setSoundEnabled = useLanStore((s) => s.setSoundEnabled);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setSoundEnabled(!soundEnabled)}
      title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
      aria-label={soundEnabled ? "Mute notifications" : "Unmute notifications"}
    >
      {soundEnabled ? (
        <Volume2 className="h-4 w-4" />
      ) : (
        <VolumeX className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-brand text-brand-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span className="ml-0.5 bg-brand-foreground/20 text-brand-foreground text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}
