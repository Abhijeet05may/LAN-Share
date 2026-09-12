"use client";

import * as React from "react";
import {
  Network as NetworkIcon,
  Save,
  Loader2,
  RotateCcw,
  QrCode,
  KeyRound,
  AlertTriangle,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsField } from "../SettingsField";
import { SectionCard } from "../SectionCard";
import type { AdminSettings } from "../AdminPanel";
import { toast } from "sonner";

interface NetworkSectionProps {
  settings: AdminSettings;
  updateSettings: (partial: Record<string, string>) => Promise<void>;
}

interface NetworkInfo {
  url: string;
  host: string;
  port: number;
  qrCodeDataUrl: string | null;
}

export function NetworkSection({ settings, updateSettings }: NetworkSectionProps) {
  const initialPinEnabled = (settings["network.pinEnabled"] ?? "false") === "true";
  const initialPin = settings["network.pin"] ?? "";
  const initialMaxDevices = settings["network.maxDevices"] ?? "0";
  const initialQrVisible = (settings["network.qrVisible"] ?? "true") === "true";
  const initialPort = settings["network.port"] ?? "3000";

  const [pinEnabled, setPinEnabled] = React.useState(initialPinEnabled);
  const [pin, setPin] = React.useState(initialPin);
  const [maxDevices, setMaxDevices] = React.useState(initialMaxDevices);
  const [qrVisible, setQrVisible] = React.useState(initialQrVisible);
  const [port, setPort] = React.useState(initialPort);
  const [saving, setSaving] = React.useState(false);

  const [netInfo, setNetInfo] = React.useState<NetworkInfo | null>(null);
  const [netInfoLoading, setNetInfoLoading] = React.useState(true);

  React.useEffect(() => {
    setPinEnabled((settings["network.pinEnabled"] ?? "false") === "true");
    setPin(settings["network.pin"] ?? "");
    setMaxDevices(settings["network.maxDevices"] ?? "0");
    setQrVisible((settings["network.qrVisible"] ?? "true") === "true");
    setPort(settings["network.port"] ?? "3000");
  }, [settings]);

  const loadNetInfo = React.useCallback(async () => {
    setNetInfoLoading(true);
    try {
      const res = await fetch("/api/network-info", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NetworkInfo;
      setNetInfo(json);
    } catch {
      setNetInfo(null);
    } finally {
      setNetInfoLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadNetInfo();
  }, [loadNetInfo]);

  const dirty = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (pinEnabled !== initialPinEnabled)
      out["network.pinEnabled"] = pinEnabled ? "true" : "false";
    if (pin !== initialPin) out["network.pin"] = pin;
    if (maxDevices !== initialMaxDevices) out["network.maxDevices"] = maxDevices;
    if (qrVisible !== initialQrVisible)
      out["network.qrVisible"] = qrVisible ? "true" : "false";
    if (port !== initialPort) out["network.port"] = port;
    return out;
  }, [
    pinEnabled,
    pin,
    maxDevices,
    qrVisible,
    port,
    initialPinEnabled,
    initialPin,
    initialMaxDevices,
    initialQrVisible,
    initialPort,
  ]);

  const hasDirty = Object.keys(dirty).length > 0;
  const portDirty = !!dirty["network.port"];

  const handleSave = async () => {
    if (!hasDirty) return;
    setSaving(true);
    try {
      await updateSettings(dirty);
      if (portDirty) {
        toast.warning("Server port saved", {
          description:
            "Port changes only apply after a manual server restart.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPinEnabled(initialPinEnabled);
    setPin(initialPin);
    setMaxDevices(initialMaxDevices);
    setQrVisible(initialQrVisible);
    setPort(initialPort);
    toast.message("Reverted unsaved changes");
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Network"
        description="Connection settings: PIN protection, device caps, and QR sharing."
        icon={<NetworkIcon className="h-4 w-4" />}
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
          label="Room PIN protection"
          description="Require new devices to enter a PIN before joining."
        >
          <div className="flex items-center justify-between gap-3 h-10">
            <Switch
              checked={pinEnabled}
              onCheckedChange={setPinEnabled}
              aria-label="Toggle PIN protection"
            />
            <Badge variant={pinEnabled ? "default" : "secondary"}>
              {pinEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </SettingsField>

        {pinEnabled ? (
          <SettingsField
            label="Room PIN"
            description="Shown briefly on the host. Avoid common codes like 0000."
            htmlFor="setting-pin"
          >
            <Input
              id="setting-pin"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 16))
              }
              placeholder="e.g. 4242"
              maxLength={16}
              className="h-10 font-mono"
            />
          </SettingsField>
        ) : null}

        <SettingsField
          label="Max devices"
          description="Cap how many devices can be registered. 0 = unlimited."
          htmlFor="setting-max-devices"
        >
          <Input
            id="setting-max-devices"
            type="number"
            min={0}
            value={maxDevices}
            onChange={(e) => setMaxDevices(e.target.value)}
            className="h-10"
          />
        </SettingsField>

        <SettingsField
          label="Show QR code"
          description="Display a QR code on the network info screen so mobile users can scan to join."
        >
          <div className="flex items-center justify-between gap-3 h-10">
            <Switch
              checked={qrVisible}
              onCheckedChange={setQrVisible}
              aria-label="Toggle QR code visibility"
            />
            <QrCode
              className={
                qrVisible
                  ? "h-5 w-5 text-brand"
                  : "h-5 w-5 text-muted-foreground/40"
              }
            />
          </div>
        </SettingsField>

        <SettingsField
          label="Server port"
          description="HTTP port the Next.js server listens on. Display-only — changes need a restart."
          htmlFor="setting-port"
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="h-10 font-mono"
            />
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 gap-1 whitespace-nowrap"
            >
              <AlertTriangle className="h-3 w-3" /> Requires restart
            </Badge>
          </div>
        </SettingsField>
      </SectionCard>

      {/* Read-only detected LAN info */}
      <SectionCard
        title="Detected network address"
        description="What the server reports as its reachable LAN URL."
        icon={<Wifi className="h-4 w-4" />}
      >
        {netInfoLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : netInfo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Reachable at:</span>
              <code className="font-mono font-semibold text-brand">
                {netInfo.host}:{netInfo.port}
              </code>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Full URL
              </p>
              <code className="font-mono text-xs break-all">{netInfo.url}</code>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Could not detect the LAN address. The host may be starting up.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
