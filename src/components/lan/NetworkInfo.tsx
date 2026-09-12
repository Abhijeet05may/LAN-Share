"use client";

import { useEffect, useState } from "react";
import {
  Wifi,
  Copy,
  Check,
  QrCode,
  Network,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanStore } from "@/lib/lan/store";
import type { NetworkInfo as NetInfo } from "@/lib/lan/types";
import { toast } from "sonner";

export function NetworkInfo() {
  const self = useLanStore((s) => s.self);
  const devices = useLanStore((s) => s.devices);
  const [info, setInfo] = useState<NetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/network-info");
      if (res.ok) setInfo(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  const onlineCount = devices.filter((d) => d.online).length;

  const copyUrl = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  return (
    <ScrollArea className="h-full scrollbar-thin">
      <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-5">
        {/* Header banner */}
        <div className="rounded-2xl border bg-brand-gradient p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-10 w-10 rounded-xl bg-brand text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/30">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Network Info</h2>
                <p className="text-xs text-muted-foreground">
                  How other devices can join
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge
                variant="secondary"
                className="bg-background/80 backdrop-blur"
              >
                <Users className="h-3 w-3 mr-1" /> {onlineCount} online
              </Badge>
              <Badge
                variant="secondary"
                className="bg-background/80 backdrop-blur"
              >
                <ShieldCheck className="h-3 w-3 mr-1" /> LAN-only
              </Badge>
            </div>
          </div>
        </div>

        {/* QR + URL card */}
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* QR */}
            <div className="shrink-0">
              <div className="rounded-xl border-2 border-foreground/10 bg-white p-3 shadow-sm">
                {loading ? (
                  <div className="h-40 w-40 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : info?.qrCodeDataUrl ? (
                  <img
                    src={info.qrCodeDataUrl}
                    alt="QR code to join"
                    className="h-40 w-40"
                  />
                ) : (
                  <div className="h-40 w-40 flex flex-col items-center justify-center text-muted-foreground">
                    <QrCode className="h-10 w-10 mb-2" />
                    <span className="text-xs">QR unavailable</span>
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <Smartphone className="h-3 w-3" /> Scan to join
              </p>
            </div>

            {/* URL */}
            <div className="flex-1 w-full min-w-0">
              <h3 className="text-sm font-semibold mb-1">Host address</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Open this URL in any browser on a device connected to the same
                network.
              </p>
              <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-2">
                <Network className="h-4 w-4 text-brand shrink-0" />
                <code className="text-sm font-mono truncate flex-1">
                  {info?.url || "—"}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyUrl}
                  className="h-8 shrink-0"
                  disabled={!info}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-[var(--online)]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <InfoTile label="Host IP" value={info?.host || "—"} />
                <InfoTile label="Port" value={String(info?.port || "—")} />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInfo}
                className="mt-3 w-full"
                disabled={loading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh network info
              </Button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <h3 className="text-sm font-semibold mb-3">How to connect</h3>
          <ol className="space-y-3">
            <Step
              n={1}
              title="Stay on the same network"
              desc="Make sure every device is on the same WiFi or LAN as this host."
            />
            <Step
              n={2}
              title="Open the host URL"
              desc={`Type ${info?.url || "the host address"} into a browser, or scan the QR code above with a phone camera.`}
            />
            <Step
              n={3}
              title="Pick a name & join"
              desc="Each device picks a display name and instantly appears in the device list."
            />
            <Step
              n={4}
              title="Share & chat"
              desc="Send files to everyone or specific devices, and chat in the group or privately."
            />
          </ol>
        </div>

        {/* Troubleshooting */}
        <div className="rounded-2xl border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold mb-2">Can’t connect?</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-brand">•</span>
              Verify all devices are on the same WiFi/LAN (not a guest network).
            </li>
            <li className="flex gap-2">
              <span className="text-brand">•</span>
              Allow the app port ({info?.port || "3000"}) through the host’s
              firewall.
            </li>
            <li className="flex gap-2">
              <span className="text-brand">•</span>
              Some networks isolate clients — try a mobile hotspot if needed.
            </li>
            <li className="flex gap-2">
              <span className="text-brand">•</span>
              You are{" "}
              <span className="font-medium text-foreground">{self?.name}</span>{" "}
              on this network.
            </li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-mono font-medium truncate">{value}</p>
    </div>
  );
}

function Step({
  n,
  title,
  desc,
}: {
  n: number;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-xs font-bold shrink-0">
        {n}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </li>
  );
}
