"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  LayoutDashboard,
  Settings2,
  Network,
  FileText,
  MessageSquare,
  ShieldAlert,
  MonitorSmartphone,
  Trash2,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/lan/ThemeToggle";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { toast } from "sonner";
import { DashboardSection } from "./sections/DashboardSection";
import { GeneralSection } from "./sections/GeneralSection";
import { NetworkSection } from "./sections/NetworkSection";
import { FilesSection } from "./sections/FilesSection";
import { ChatSection } from "./sections/ChatSection";
import { SecuritySection } from "./sections/SecuritySection";
import { DevicesSection } from "./sections/DevicesSection";
import { MaintenanceSection } from "./sections/MaintenanceSection";

export type AdminSettings = Record<string, string>;

type TabId =
  | "dashboard"
  | "general"
  | "network"
  | "files"
  | "chat"
  | "security"
  | "devices"
  | "maintenance";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  { id: "general", label: "General", icon: <Settings2 className="h-4 w-4" /> },
  { id: "network", label: "Network", icon: <Network className="h-4 w-4" /> },
  { id: "files", label: "Files", icon: <FileText className="h-4 w-4" /> },
  { id: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
  {
    id: "security",
    label: "Security",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  { id: "devices", label: "Devices", icon: <MonitorSmartphone className="h-4 w-4" /> },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: <Trash2 className="h-4 w-4" />,
  },
];

interface AdminPanelProps {
  /** Called when the user clicks "Logout" — the parent refetches session. */
  onLogout: () => void;
}

export function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = React.useState<TabId>("dashboard");

  const [settings, setSettings] = React.useState<AdminSettings | null>(null);
  const [isDefaultPassword, setIsDefaultPassword] = React.useState(false);
  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        settings: AdminSettings;
        isDefaultPassword: boolean;
      };
      setSettings(data.settings || {});
      setIsDefaultPassword(!!data.isDefaultPassword);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not load settings";
      setSettingsError(msg);
      toast.error("Failed to load settings", { description: msg });
    } finally {
      setSettingsLoading(false);
    }
  }, [onLogout]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Lightweight live online-device count for the sidebar badge (polls the
  // admin devices endpoint every 8s — reuses the same auth cookie).
  const [onlineCount, setOnlineCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/devices", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { devices?: { online?: boolean }[] };
        const n = (data.devices || []).filter((d) => d.online).length;
        if (!cancelled) setOnlineCount(n);
      } catch {
        /* ignore — badge just won't update */
      }
    };
    void poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Push a partial update to the backend then refetch the canonical state.
  const updateSettings = React.useCallback(
    async (partial: Record<string, string>) => {
      const keys = Object.keys(partial);
      if (keys.length === 0) {
        toast.message("Nothing to save");
        return;
      }
      try {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: partial }),
        });
        if (res.status === 401) {
          onLogout();
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Save failed" }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        // Optimistically merge + refetch for canonical state.
        setSettings((prev) => ({ ...(prev || {}), ...partial }));
        toast.success("Settings saved", {
          description:
            keys.length === 1 ? keys[0] : `${keys.length} fields updated`,
        });
        // Refetch quietly so any backend-side coercion is picked up.
        void loadSettings();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed";
        toast.error("Failed to save settings", { description: msg });
        throw err;
      }
    },
    [loadSettings, onLogout]
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* ignore — we'll drop session locally anyway */
    }
    toast.success("Logged out");
    onLogout();
  };

  const appName = settings?.["app.name"] || "LAN Share";

  const renderTab = (id: TabId) => {
    if (id === "dashboard") return <DashboardSection />;
    if (settingsLoading || !settings) {
      return (
        <div className="space-y-4 p-1">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }
    switch (id) {
      case "general":
        return (
          <GeneralSection
            settings={settings}
            updateSettings={updateSettings}
          />
        );
      case "network":
        return (
          <NetworkSection
            settings={settings}
            updateSettings={updateSettings}
          />
        );
      case "files":
        return (
          <FilesSection settings={settings} updateSettings={updateSettings} />
        );
      case "chat":
        return (
          <ChatSection settings={settings} updateSettings={updateSettings} />
        );
      case "security":
        return (
          <SecuritySection
            settings={settings}
            updateSettings={updateSettings}
          />
        );
      case "devices":
        return <DevicesSection />;
      case "maintenance":
        return (
          <MaintenanceSection onSettingsReset={loadSettings} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-brand shrink-0" aria-hidden />

      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur-md">
        <div className="flex items-center gap-2 h-14 px-3 sm:px-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-brand text-brand-foreground flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                <span className="truncate">{appName}</span>
                <Badge
                  variant="secondary"
                  className="bg-brand/15 text-brand border-brand/20 uppercase tracking-wide text-[9px] px-1.5 py-0"
                >
                  Admin
                </Badge>
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Network management console
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden md:block">
              <ChangePasswordDialog triggerLabel="Password" />
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              asChild
              title="Open the user-facing app"
            >
              <Link href="/">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">View app</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
              title="Log out of admin"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Default-password banner */}
      {isDefaultPassword ? (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs sm:text-sm px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Default admin password is in use. Change it now to secure your
              network.
            </span>
          </span>
          <div className="hidden sm:block shrink-0">
            <ChangePasswordDialog
              triggerLabel="Change"
              triggerVariant="outline"
              triggerClassName="h-7 text-xs"
            />
          </div>
        </div>
      ) : null}

      {/* Body: sidebar + main */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-[240px] shrink-0 border-r bg-card/40 flex-col">
          <nav className="p-2 space-y-0.5 flex-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px]",
                  activeTab === t.id
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-current={activeTab === t.id ? "page" : undefined}
              >
                <span
                  className={cn(
                    activeTab === t.id
                      ? "text-brand-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {t.icon}
                </span>
                {t.label}
                {t.id === "devices" && onlineCount !== null && onlineCount > 0 && (
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      activeTab === t.id
                        ? "bg-brand-foreground/20 text-brand-foreground"
                        : "bg-[var(--online)]/15 text-[var(--online)]"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--online)] animate-pulse-dot" />
                    {onlineCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t">
            <ChangePasswordDialog
              triggerLabel="Change password"
              triggerVariant="outline"
              triggerClassName="w-full"
            />
          </div>
        </aside>

        {/* Mobile horizontal tab strip */}
        <div className="lg:hidden sticky top-14 z-20 border-b bg-background/95 backdrop-blur-md">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin px-2 py-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors min-h-[36px]",
                  activeTab === t.id
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {t.icon}
                {t.label}
                {t.id === "devices" && onlineCount !== null && onlineCount > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums min-w-[16px]",
                      activeTab === t.id
                        ? "bg-brand-foreground/20 text-brand-foreground"
                        : "bg-[var(--online)]/15 text-[var(--online)]"
                    )}
                  >
                    {onlineCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col bg-background">
          {/* Top header strip for current tab */}
          <div className="border-b bg-card/30 px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              {TABS.find((t) => t.id === activeTab)?.icon}
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>

          {settingsError && activeTab !== "dashboard" && activeTab !== "devices" ? (
            <div className="p-4 sm:p-6">
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load settings: {settingsError}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3"
                  onClick={() => void loadSettings()}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex-1 min-h-0">
            <div key={activeTab} className="animate-fade-in p-4 sm:p-6">
              {renderTab(activeTab)}
            </div>
          </div>
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="mt-auto shrink-0 border-t bg-card/60 backdrop-blur-md">
        <div className="px-4 py-2.5 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-brand" />
            LAN Share Admin
            <span className="text-muted-foreground/60">·</span>
            <span>v1.0.0</span>
          </span>
          <span className="hidden sm:inline">
            All actions are logged for audit.
          </span>
        </div>
      </footer>
    </div>
  );
}
