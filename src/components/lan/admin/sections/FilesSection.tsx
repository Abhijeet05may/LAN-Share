"use client";

import * as React from "react";
import {
  FileText,
  Save,
  Loader2,
  RotateCcw,
  HardDrive,
  Clock,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsField } from "../SettingsField";
import { SectionCard } from "../SectionCard";
import type { AdminSettings } from "../AdminPanel";
import { toast } from "sonner";

interface FilesSectionProps {
  settings: AdminSettings;
  updateSettings: (partial: Record<string, string>) => Promise<void>;
}

export function FilesSection({ settings, updateSettings }: FilesSectionProps) {
  const initialMaxSize = settings["files.maxSizeMB"] ?? "0";
  const initialExtMode = settings["files.extensionMode"] ?? "off";
  const initialExtList = settings["files.extensionList"] ?? "";
  const initialQuota = settings["files.storageQuotaMB"] ?? "0";
  const initialAutoMode = settings["files.autoDeleteMode"] ?? "never";
  const initialAutoHours = settings["files.autoDeleteHours"] ?? "24";
  const initialPreview = (settings["files.previewEnabled"] ?? "true") === "true";

  const [maxSize, setMaxSize] = React.useState(initialMaxSize);
  const [extMode, setExtMode] = React.useState(initialExtMode);
  const [extList, setExtList] = React.useState(initialExtList);
  const [quota, setQuota] = React.useState(initialQuota);
  const [autoMode, setAutoMode] = React.useState(initialAutoMode);
  const [autoHours, setAutoHours] = React.useState(initialAutoHours);
  const [preview, setPreview] = React.useState(initialPreview);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setMaxSize(settings["files.maxSizeMB"] ?? "0");
    setExtMode(settings["files.extensionMode"] ?? "off");
    setExtList(settings["files.extensionList"] ?? "");
    setQuota(settings["files.storageQuotaMB"] ?? "0");
    setAutoMode(settings["files.autoDeleteMode"] ?? "never");
    setAutoHours(settings["files.autoDeleteHours"] ?? "24");
    setPreview((settings["files.previewEnabled"] ?? "true") === "true");
  }, [settings]);

  const dirty = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (maxSize !== initialMaxSize) out["files.maxSizeMB"] = maxSize;
    if (extMode !== initialExtMode) out["files.extensionMode"] = extMode;
    if (extList !== initialExtList) out["files.extensionList"] = extList;
    if (quota !== initialQuota) out["files.storageQuotaMB"] = quota;
    if (autoMode !== initialAutoMode) out["files.autoDeleteMode"] = autoMode;
    if (autoHours !== initialAutoHours) out["files.autoDeleteHours"] = autoHours;
    if (preview !== initialPreview)
      out["files.previewEnabled"] = preview ? "true" : "false";
    return out;
  }, [
    maxSize,
    extMode,
    extList,
    quota,
    autoMode,
    autoHours,
    preview,
    initialMaxSize,
    initialExtMode,
    initialExtList,
    initialQuota,
    initialAutoMode,
    initialAutoHours,
    initialPreview,
  ]);

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
    setMaxSize(initialMaxSize);
    setExtMode(initialExtMode);
    setExtList(initialExtList);
    setQuota(initialQuota);
    setAutoMode(initialAutoMode);
    setAutoHours(initialAutoHours);
    setPreview(initialPreview);
    toast.message("Reverted unsaved changes");
  };

  return (
    <SectionCard
      title="Files"
      description="Upload limits, extension filters, storage quota, and retention policy."
      icon={<FileText className="h-4 w-4" />}
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
        label="Max file size (MB)"
        description="Reject uploads larger than this. 0 = unlimited."
        htmlFor="setting-max-size"
      >
        <Input
          id="setting-max-size"
          type="number"
          min={0}
          value={maxSize}
          onChange={(e) => setMaxSize(e.target.value)}
          className="h-10"
        />
      </SettingsField>

      <SettingsField
        label="Extension filter mode"
        description="Allow only listed extensions, or block specific ones."
        htmlFor="setting-ext-mode"
      >
        <Select value={extMode} onValueChange={setExtMode}>
          <SelectTrigger id="setting-ext-mode" className="w-full h-10">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off — allow all</SelectItem>
            <SelectItem value="whitelist">Whitelist — only listed</SelectItem>
            <SelectItem value="blacklist">Blacklist — block listed</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>

      {extMode !== "off" ? (
        <SettingsField
          label={extMode === "whitelist" ? "Allowed extensions" : "Blocked extensions"}
          description={
            extMode === "whitelist"
              ? "Comma-separated list of extensions that ARE allowed (e.g. pdf, png, txt)."
              : "Comma-separated list of extensions that will be REJECTED (e.g. exe, bat, sh)."
          }
          htmlFor="setting-ext-list"
        >
          <Textarea
            id="setting-ext-list"
            value={extList}
            onChange={(e) => setExtList(e.target.value)}
            placeholder="pdf, png, jpg, txt, zip"
            className="font-mono text-sm min-h-[80px]"
          />
        </SettingsField>
      ) : null}

      <SettingsField
        label="Storage quota (MB)"
        description="Total disk space all uploads can use. 0 = unlimited."
        htmlFor="setting-quota"
      >
        <div className="flex items-center gap-2">
          <Input
            id="setting-quota"
            type="number"
            min={0}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            className="h-10"
          />
          <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </SettingsField>

      <SettingsField
        label="Auto-delete mode"
        description="When to remove uploaded files from disk."
        htmlFor="setting-auto-mode"
      >
        <Select value={autoMode} onValueChange={setAutoMode}>
          <SelectTrigger id="setting-auto-mode" className="w-full h-10">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="never">Never — keep forever</SelectItem>
            <SelectItem value="hours">After N hours</SelectItem>
            <SelectItem value="afterDownload">After first download</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>

      {autoMode === "hours" ? (
        <SettingsField
          label="Auto-delete after (hours)"
          description="Files older than this are eligible for cleanup."
          htmlFor="setting-auto-hours"
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-auto-hours"
              type="number"
              min={1}
              value={autoHours}
              onChange={(e) => setAutoHours(e.target.value)}
              className="h-10"
            />
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </SettingsField>
      ) : null}

      <SettingsField
        label="File preview"
        description="Show inline previews for images and PDFs in the files panel."
      >
        <div className="flex items-center justify-between gap-3 h-10">
          <Switch
            checked={preview}
            onCheckedChange={setPreview}
            aria-label="Toggle file preview"
          />
          <div className="flex items-center gap-2">
            <Eye
              className={
                preview
                  ? "h-4 w-4 text-brand"
                  : "h-4 w-4 text-muted-foreground/40"
              }
            />
            <Badge variant={preview ? "default" : "secondary"}>
              {preview ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </SettingsField>
    </SectionCard>
  );
}
