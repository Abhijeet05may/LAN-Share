"use client";

import * as React from "react";
import {
  RefreshCw,
  Server,
  Users,
  HardDrive,
  FileText,
  MessageSquare,
  Clock,
  Activity,
  Gauge,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/lan/device";
import { SectionCard } from "../SectionCard";

interface DashboardData {
  uptimeSec: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  storageUsedPercent: number;
  activeConnections: number;
  totalDevices: number;
  totalFiles: number;
  totalMessages: number;
  appVersion: string;
}

function formatUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export function DashboardSection() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardData;
      setData(json);
      setError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not load dashboard";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh every 10 seconds while the dashboard is visible.
  React.useEffect(() => {
    const id = setInterval(() => {
      void load();
    }, 10000);
    return () => clearInterval(id);
  }, [load]);

  // Track active-connection history for the sparkline (max 20 samples).
  // Key on `data` (a fresh object each refresh) so we append a sample per
  // poll even when the value is unchanged.
  const [history, setHistory] = React.useState<number[]>([]);
  React.useEffect(() => {
    if (data) {
      setHistory((prev) => [...prev, data.activeConnections].slice(-20));
    }
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive flex items-start gap-2.5">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <div>Failed to load dashboard data: {error}</div>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--online)] animate-pulse-dot" />
            Live · auto-refreshes every 10s
          </span>
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={refreshing}
          className="h-9"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Server uptime"
          value={formatUptime(d.uptimeSec)}
          accent="brand"
        />
        <StatTile
          icon={<Activity className="h-4 w-4" />}
          label="Active connections"
          value={String(d.activeConnections)}
          hint="live sockets"
          accent="online"
          sparkline={history.length > 1 ? history : undefined}
        />
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Total devices"
          value={String(d.totalDevices)}
          hint="ever connected"
        />
        <StatTile
          icon={<FileText className="h-4 w-4" />}
          label="Total files"
          value={String(d.totalFiles)}
        />
        <StatTile
          icon={<MessageSquare className="h-4 w-4" />}
          label="Total messages"
          value={String(d.totalMessages)}
        />
        <StatTile
          icon={<Gauge className="h-4 w-4" />}
          label="App version"
          value={d.appVersion || "1.0.0"}
        />
      </div>

      {/* Storage usage */}
      <SectionCard
        title="Storage usage"
        description="Disk space used by shared files in the uploads/ folder."
        icon={<HardDrive className="h-4 w-4" />}
      >
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl font-bold tracking-tight">
                {formatBytes(d.storageUsedBytes)}
              </p>
              <p className="text-xs text-muted-foreground">
                of{" "}
                {d.storageQuotaBytes > 0
                  ? formatBytes(d.storageQuotaBytes)
                  : "unlimited"}{" "}
                used
              </p>
            </div>
            {d.storageQuotaBytes > 0 ? (
              <Badge
                variant="secondary"
                className={cn(
                  d.storageUsedPercent >= 90
                    ? "bg-destructive/15 text-destructive border-destructive/30"
                    : "bg-brand/15 text-brand border-brand/30"
                )}
              >
                {Math.round(d.storageUsedPercent)}% used
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                No quota
              </Badge>
            )}
          </div>
          {d.storageQuotaBytes > 0 ? (
            <Progress
              value={d.storageUsedPercent}
              className={cn(
                "h-2.5",
                d.storageUsedPercent >= 90 && "[&_[data-slot=progress-indicator]]:bg-destructive"
              )}
            />
          ) : (
            <Progress value={0} className="h-2.5" />
          )}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
            <MiniStat
              label="Used"
              value={formatBytes(d.storageUsedBytes)}
              icon={<HardDrive className="h-3 w-3" />}
            />
            <MiniStat
              label="Quota"
              value={
                d.storageQuotaBytes > 0
                  ? formatBytes(d.storageQuotaBytes)
                  : "∞"
              }
              icon={<Server className="h-3 w-3" />}
            />
            <MiniStat
              label="Free"
              value={
                d.storageQuotaBytes > 0
                  ? formatBytes(Math.max(0, d.storageQuotaBytes - d.storageUsedBytes))
                  : "∞"
              }
              icon={<Gauge className="h-3 w-3" />}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: "brand" | "online" | "muted";
  sparkline?: number[];
}

function StatTile({ icon, label, value, hint, accent = "muted", sparkline }: StatTileProps) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-2 min-h-[110px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground truncate">
          {label}
        </span>
        <span
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
            accent === "brand" && "bg-brand/10 text-brand",
            accent === "online" && "bg-[var(--online)]/15 text-[var(--online)]",
            accent === "muted" && "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-auto">
        <div className="flex items-end justify-between gap-2">
          <p className="text-xl sm:text-2xl font-bold tracking-tight break-all">
            {value}
          </p>
          {sparkline && sparkline.length > 1 && (
            <Sparkline data={sparkline} accent={accent} />
          )}
        </div>
        {hint ? (
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

// Inline SVG sparkline of recent numeric samples.
function Sparkline({ data, accent = "online" }: { data: number[]; accent?: string }) {
  const w = 56;
  const h = 22;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color =
    accent === "online"
      ? "var(--online)"
      : accent === "brand"
      ? "var(--brand)"
      : "var(--muted-foreground)";
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden="true">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 1 && (
        <circle
          cx={w}
          cy={h - ((data[data.length - 1] - min) / range) * h}
          r={1.8}
          fill={color}
        />
      )}
    </svg>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5 flex flex-col items-center gap-0.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-mono text-xs font-semibold">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
