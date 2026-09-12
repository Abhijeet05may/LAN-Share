"use client";

import * as React from "react";
import {
  ShieldAlert,
  Save,
  Loader2,
  RotateCcw,
  Upload,
  MessageSquare,
  Timer,
  Unlock,
  Ban,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SettingsField } from "../SettingsField";
import { SectionCard } from "../SectionCard";
import type { AdminSettings } from "../AdminPanel";
import { relativeTime } from "@/lib/lan/device";
import { toast } from "sonner";

interface SecuritySectionProps {
  settings: AdminSettings;
  updateSettings: (partial: Record<string, string>) => Promise<void>;
}

interface BlockedDevice {
  id?: string;
  deviceId: string;
  name: string;
  ip: string;
  reason: string;
  blockedAt: string;
}

export function SecuritySection({
  settings,
  updateSettings,
}: SecuritySectionProps) {
  const initialUploads = settings["security.maxUploadsPerMin"] ?? "0";
  const initialMessages = settings["security.maxMessagesPerMin"] ?? "0";
  const initialInactivity = settings["security.adminInactivityMin"] ?? "30";

  const [uploads, setUploads] = React.useState(initialUploads);
  const [messages, setMessages] = React.useState(initialMessages);
  const [inactivity, setInactivity] = React.useState(initialInactivity);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setUploads(settings["security.maxUploadsPerMin"] ?? "0");
    setMessages(settings["security.maxMessagesPerMin"] ?? "0");
    setInactivity(settings["security.adminInactivityMin"] ?? "30");
  }, [settings]);

  const dirty = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (uploads !== initialUploads)
      out["security.maxUploadsPerMin"] = uploads;
    if (messages !== initialMessages)
      out["security.maxMessagesPerMin"] = messages;
    if (inactivity !== initialInactivity)
      out["security.adminInactivityMin"] = inactivity;
    return out;
  }, [uploads, messages, inactivity, initialUploads, initialMessages, initialInactivity]);

  const hasDirty = Object.keys(dirty).length > 0;

  const handleSave = async () => {
    if (!hasDirty) return;
    setSaving(true);
    try {
      await updateSettings(dirty);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setUploads(initialUploads);
    setMessages(initialMessages);
    setInactivity(initialInactivity);
    toast.message("Reverted unsaved changes");
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Security"
        description="Rate limits and admin session timeout."
        icon={<ShieldAlert className="h-4 w-4" />}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={!hasDirty || saving}
            >
              <RotateCcw className="h-4 w-4" /> Revert
            </Button>
            <Button
              size="sm"
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={handleSave}
              disabled={!hasDirty || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </>
        }
      >
        <SettingsField
          label="Max uploads per minute"
          description="Per-device cap on upload initiations per 60s. 0 = unlimited."
          htmlFor="setting-uploads"
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-uploads"
              type="number"
              min={0}
              value={uploads}
              onChange={(e) => setUploads(e.target.value)}
              className="h-10"
            />
            <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </SettingsField>

        <SettingsField
          label="Max messages per minute"
          description="Per-device cap on chat messages per 60s. 0 = unlimited."
          htmlFor="setting-messages"
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-messages"
              type="number"
              min={0}
              value={messages}
              onChange={(e) => setMessages(e.target.value)}
              className="h-10"
            />
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </SettingsField>

        <SettingsField
          label="Admin inactivity timeout (minutes)"
          description="Auto-logout after this many minutes idle. 0 = never."
          htmlFor="setting-inactivity"
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-inactivity"
              type="number"
              min={0}
              value={inactivity}
              onChange={(e) => setInactivity(e.target.value)}
              className="h-10"
            />
            <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </SettingsField>
      </SectionCard>

      <BlockedDevicesCard />
    </div>
  );
}

function BlockedDevicesCard() {
  const [items, setItems] = React.useState<BlockedDevice[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [unblocking, setUnblocking] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/blocked-devices", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { devices: BlockedDevice[] };
      setItems(Array.isArray(data.devices) ? data.devices : []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not load blocked devices";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleUnblock = async (deviceId: string) => {
    setUnblocking(deviceId);
    try {
      const res = await fetch(
        `/api/admin/devices/${encodeURIComponent(deviceId)}/unblock`,
        { method: "POST" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Unblock failed" }));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      toast.success("Device unblocked", {
        description: "It can rejoin the network now.",
      });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unblock failed";
      toast.error("Could not unblock device", { description: msg });
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <SectionCard
      title="Blocked devices"
      description="Devices blocked from rejoining. Unblock to allow them back in."
      icon={<Ban className="h-4 w-4" />}
      danger
      footer={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-start gap-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      ) : !items || items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-brand/10 flex items-center justify-center mb-3">
            <ShieldAlert className="h-6 w-6 text-brand" />
          </div>
          <p className="text-sm font-medium">No blocked devices</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Devices you block from the Devices tab will appear here. Blocked
            devices cannot rejoin the network until unblocked.
          </p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto scrollbar-thin -mx-1">
          <ul className="divide-y divide-border">
            {items.map((d) => (
              <li
                key={d.deviceId}
                className="flex items-center gap-3 px-1 py-2.5"
              >
                <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <Ban className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {d.name || "Unknown device"}
                    </span>
                    {d.ip ? (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {d.ip}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 min-w-0">
                    <span className="truncate">
                      {d.reason ? `“${d.reason}”` : "No reason given"}
                    </span>
                    <Separator orientation="vertical" className="h-3" />
                    <span className="shrink-0">
                      {relativeTime(d.blockedAt)}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleUnblock(d.deviceId)}
                  disabled={unblocking === d.deviceId}
                  className={cn(
                    "h-8 shrink-0 border-brand/30 text-brand hover:bg-brand/10 hover:text-brand"
                  )}
                >
                  {unblocking === d.deviceId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" />
                  )}
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
