"use client";

import * as React from "react";
import {
  MonitorSmartphone as DevicesIcon,
  MoreVertical,
  RefreshCw,
  Pencil,
  Ban,
  Unlock,
  LogOut,
  Laptop,
  Smartphone,
  Tablet,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeviceAvatar } from "@/components/lan/DeviceAvatar";
import { relativeTime } from "@/lib/lan/device";
import type { DeviceType } from "@/lib/lan/types";
import { toast } from "sonner";

interface AdminDevice {
  id: string;
  name: string;
  deviceType: string;
  userAgent?: string;
  ip?: string;
  avatarColor: string;
  createdAt: string;
  lastSeen: string;
  online: boolean;
  blocked: boolean;
}

function asDeviceType(s: string): DeviceType {
  if (s === "mobile" || s === "tablet") return s;
  return "desktop";
}

function DeviceTypeIcon({ type }: { type: string }) {
  if (type === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (type === "tablet") return <Tablet className="h-3.5 w-3.5" />;
  return <Laptop className="h-3.5 w-3.5" />;
}

export function DevicesSection() {
  const [devices, setDevices] = React.useState<AdminDevice[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  // Dialog states
  const [renameTarget, setRenameTarget] = React.useState<AdminDevice | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);

  const [kickTarget, setKickTarget] = React.useState<AdminDevice | null>(null);
  const [kicking, setKicking] = React.useState(false);

  const [blockTarget, setBlockTarget] = React.useState<AdminDevice | null>(null);
  const [blocking, setBlocking] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/devices", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { devices: AdminDevice[] };
      setDevices(Array.isArray(data.devices) ? data.devices : []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not load devices";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openRename = (d: AdminDevice) => {
    setRenameTarget(d);
    setRenameValue(d.name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch(
        `/api/admin/devices/${encodeURIComponent(renameTarget.id)}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Rename failed" }));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      toast.success("Device renamed", { description: name });
      setRenameTarget(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rename failed";
      toast.error("Could not rename device", { description: msg });
    } finally {
      setRenaming(false);
    }
  };

  const handleKick = async () => {
    if (!kickTarget) return;
    setKicking(true);
    try {
      const res = await fetch(
        `/api/admin/devices/${encodeURIComponent(kickTarget.id)}/kick`,
        { method: "POST" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Kick failed" }));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      toast.success("Device kicked", {
        description: kickTarget.name || kickTarget.id,
      });
      setKickTarget(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kick failed";
      toast.error("Could not kick device", { description: msg });
    } finally {
      setKicking(false);
    }
  };

  const handleBlock = async () => {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      const res = await fetch(
        `/api/admin/devices/${encodeURIComponent(blockTarget.id)}/block`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Blocked by admin" }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Block failed" }));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      toast.success("Device blocked", {
        description: blockTarget.name || blockTarget.id,
      });
      setBlockTarget(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Block failed";
      toast.error("Could not block device", { description: msg });
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (d: AdminDevice) => {
    try {
      const res = await fetch(
        `/api/admin/devices/${encodeURIComponent(d.id)}/unblock`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unblock failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success("Device unblocked", { description: d.name || d.id });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unblock failed";
      toast.error("Could not unblock device", { description: msg });
    }
  };

  const filtered = React.useMemo(() => {
    if (!devices) return [];
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.ip || "").toLowerCase().includes(q)
    );
  }, [devices, query]);

  const onlineCount = devices?.filter((d) => d.online).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {devices ? (
              <>
                <span className="font-semibold text-foreground">
                  {devices.length}
                </span>{" "}
                total,{" "}
                <span className="font-semibold text-[var(--online)]">
                  {onlineCount}
                </span>{" "}
                online
              </>
            ) : (
              "Loading devices…"
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, IP, id…"
              className="h-9 pl-8 w-44 sm:w-56"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-9"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {error ? (
          <div className="p-4 flex items-start gap-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        ) : loading && !devices ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <DevicesIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {devices && devices.length > 0
                ? "No devices match your search"
                : "No devices yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {devices && devices.length > 0
                ? "Try clearing the search filter."
                : "When devices join the network, they'll appear here."}
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="min-w-[180px]">Device</TableHead>
                  <TableHead className="min-w-[80px]">Type</TableHead>
                  <TableHead className="min-w-[110px]">IP</TableHead>
                  <TableHead className="min-w-[100px]">First seen</TableHead>
                  <TableHead className="min-w-[100px]">Last seen</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="text-right w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <DeviceAvatar
                          name={d.name || "?"}
                          color={d.avatarColor || "#64748b"}
                          deviceType={asDeviceType(d.deviceType)}
                          online={d.online}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            <span className="truncate">{d.name || "Unnamed"}</span>
                            {d.blocked ? (
                              <Badge
                                variant="outline"
                                className="border-destructive/30 text-destructive bg-destructive/10 text-[9px] px-1 py-0"
                              >
                                Blocked
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono truncate">
                            {d.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                        <DeviceTypeIcon type={d.deviceType} />
                        {d.deviceType || "desktop"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs font-mono text-muted-foreground">
                        {d.ip || "—"}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relativeTime(d.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relativeTime(d.lastSeen)}
                    </TableCell>
                    <TableCell>
                      {d.online ? (
                        <Badge
                          variant="outline"
                          className="border-[var(--online)]/40 text-[var(--online)] bg-[var(--online)]/10 gap-1"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--online)] animate-pulse-dot" />
                          Online
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          Offline
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Device actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>Device actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openRename(d)}>
                            <Pencil className="h-3.5 w-3.5" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setKickTarget(d)}
                            disabled={!d.online || d.blocked}
                          >
                            <LogOut className="h-3.5 w-3.5" /> Kick
                          </DropdownMenuItem>
                          {d.blocked ? (
                            <DropdownMenuItem
                              onClick={() => void handleUnblock(d)}
                            >
                              <Unlock className="h-3.5 w-3.5" /> Unblock
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setBlockTarget(d)}
                            >
                              <Ban className="h-3.5 w-3.5" /> Block
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename device</DialogTitle>
            <DialogDescription>
              Change the display name shown to everyone on the network.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={32}
              className="h-10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRename();
              }}
            />
            {renameTarget ? (
              <p className="text-[11px] text-muted-foreground font-mono">
                {renameTarget.id}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameTarget(null)}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={() => void handleRename()}
              disabled={renaming || !renameValue.trim()}
            >
              {renaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kick confirm */}
      <AlertDialog
        open={!!kickTarget}
        onOpenChange={(o) => !o && setKickTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kick this device?</AlertDialogTitle>
            <AlertDialogDescription>
              {kickTarget?.name || "This device"} will be immediately
              disconnected from the network. It can rejoin unless you also block
              it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={kicking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={(e) => {
                e.preventDefault();
                void handleKick();
              }}
              disabled={kicking}
            >
              {kicking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Kick device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block confirm */}
      <AlertDialog
        open={!!blockTarget}
        onOpenChange={(o) => !o && setBlockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this device?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {blockTarget?.name || "This device"}
              </span>{" "}
              will be kicked and added to the block list. It will not be able to
              rejoin until you unblock it from the Security tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleBlock();
              }}
              disabled={blocking}
            >
              {blocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Block device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
