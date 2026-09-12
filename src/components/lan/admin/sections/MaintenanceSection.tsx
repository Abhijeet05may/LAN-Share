"use client";

import * as React from "react";
import {
  Trash2,
  MessageSquareX,
  FileX,
  RefreshCcw,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { SectionCard } from "../SectionCard";
import { toast } from "sonner";

interface MaintenanceSectionProps {
  /** Called after a successful "reset settings" so the parent can refetch. */
  onSettingsReset: () => void | Promise<void>;
}

type DialogKind = "clearChat" | "deleteFiles" | "resetSettings" | null;

export function MaintenanceSection({ onSettingsReset }: MaintenanceSectionProps) {
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [busy, setBusy] = React.useState(false);
  const [exporting, setExporting] = React.useState<"json" | "csv" | null>(null);

  const runAction = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog === "clearChat") {
        const res = await fetch("/api/admin/maintenance/clear-chat", {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Chat history cleared", {
          description: "All messages have been deleted.",
        });
      } else if (dialog === "deleteFiles") {
        const res = await fetch("/api/admin/maintenance/delete-files", {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("All files deleted", {
          description: "Uploads folder is now empty.",
        });
      } else if (dialog === "resetSettings") {
        const res = await fetch("/api/admin/maintenance/reset-settings", {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Settings reset to defaults");
        await onSettingsReset();
      }
      setDialog(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      toast.error("Maintenance action failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    setExporting(format);
    try {
      // The admin cookie is sent automatically (same-origin). Trigger a
      // browser download via a synthetic <a> click.
      const a = document.createElement("a");
      a.href = `/api/admin/maintenance/export-logs?format=${format}`;
      a.download =
        format === "csv" ? "lan-share-logs.csv" : "lan-share-logs.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Preparing ${format.toUpperCase()} log export`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error("Export failed", { description: msg });
    } finally {
      // Brief delay so the spinner shows even on fast clicks.
      setTimeout(() => setExporting(null), 600);
    }
  };

  return (
    <div className="space-y-5">
      {/* Export logs (not destructive) */}
      <SectionCard
        title="Audit logs"
        description="Download the admin action log for review."
        icon={<Download className="h-4 w-4" />}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void handleExport("json")}
            disabled={exporting !== null}
            className="h-9"
          >
            {exporting === "json" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleExport("csv")}
            disabled={exporting !== null}
            className="h-9"
          >
            {exporting === "csv" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </Button>
          <span className="text-xs text-muted-foreground">
            Up to 1000 most recent entries.
          </span>
        </div>
      </SectionCard>

      {/* Danger zone */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">
            Danger zone
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 px-1 max-w-2xl">
          These actions are irreversible. Confirm carefully — they affect every
          connected device.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DangerCard
            title="Clear all chat history"
            description="Permanently delete every message in the database."
            icon={<MessageSquareX className="h-4 w-4" />}
            buttonText="Clear chat"
            onConfirm={() => setDialog("clearChat")}
          />
          <DangerCard
            title="Delete all shared files"
            description="Remove every uploaded file from disk and the database."
            icon={<FileX className="h-4 w-4" />}
            buttonText="Delete files"
            onConfirm={() => setDialog("deleteFiles")}
          />
          <DangerCard
            title="Reset all settings"
            description="Restore every setting to its default value. Admin password is kept."
            icon={<RefreshCcw className="h-4 w-4" />}
            buttonText="Reset settings"
            onConfirm={() => setDialog("resetSettings")}
          />
        </div>
      </div>

      {/* Confirm dialogs (single shared, content swaps per action) */}
      <AlertDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && !busy && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {dialog === "clearChat"
                ? "Clear all chat history?"
                : dialog === "deleteFiles"
                ? "Delete all shared files?"
                : "Reset all settings to default?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "clearChat"
                ? "Every message in the database will be permanently deleted. This cannot be undone. Devices will see their chat windows go blank."
                : dialog === "deleteFiles"
                ? "All uploaded files will be deleted from disk and removed from the database. Active downloads may fail. This cannot be undone."
                : "Every setting (network, files, chat, security) will be reset to its factory default. The admin password is preserved. Connected clients will pick up the new settings live."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void runAction();
              }}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {dialog === "clearChat"
                ? "Clear chat"
                : dialog === "deleteFiles"
                ? "Delete files"
                : "Reset settings"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DangerCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  buttonText: string;
  onConfirm: () => void;
}

function DangerCard({
  title,
  description,
  icon,
  buttonText,
  onConfirm,
}: DangerCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-col gap-3"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h4 className="text-sm font-semibold leading-tight">{title}</h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">
        {description}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onConfirm}
        className={cn(
          "self-start h-9 border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
        )}
      >
        {buttonText}
      </Button>
    </div>
  );
}
