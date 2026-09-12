"use client";

import * as React from "react";
import { Save, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface GeneralSectionProps {
  settings: AdminSettings;
  updateSettings: (partial: Record<string, string>) => Promise<void>;
}

export function GeneralSection({ settings, updateSettings }: GeneralSectionProps) {
  const initialAppName = settings["app.name"] ?? "";
  const initialTheme = settings["theme.default"] ?? "system";
  const initialRoomName = settings["network.roomName"] ?? "";

  const [appName, setAppName] = React.useState(initialAppName);
  const [theme, setTheme] = React.useState(initialTheme);
  const [roomName, setRoomName] = React.useState(initialRoomName);
  const [saving, setSaving] = React.useState(false);

  // Sync from server whenever the canonical settings change (e.g. after a save
  // round-trip or a reset-settings action triggered elsewhere).
  React.useEffect(() => {
    setAppName(settings["app.name"] ?? "");
    setTheme(settings["theme.default"] ?? "system");
    setRoomName(settings["network.roomName"] ?? "");
  }, [settings]);

  const dirty = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (appName !== initialAppName) out["app.name"] = appName;
    if (theme !== initialTheme) out["theme.default"] = theme;
    if (roomName !== initialRoomName) out["network.roomName"] = roomName;
    return out;
  }, [appName, theme, roomName, initialAppName, initialTheme, initialRoomName]);

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
    setAppName(initialAppName);
    setTheme(initialTheme);
    setRoomName(initialRoomName);
    toast.message("Reverted unsaved changes");
  };

  return (
    <SectionCard
      title="General"
      description="App identity, default theme, and room name shown to users."
      icon={<Settings2 className="h-4 w-4" />}
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
        label="App name"
        description="Shown in the header of the user-facing app and in browser tab."
        htmlFor="setting-app-name"
      >
        <Input
          id="setting-app-name"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="LAN Share"
          maxLength={48}
          className="h-10"
        />
      </SettingsField>

      <SettingsField
        label="Default theme"
        description="Applied to first-time visitors. They can switch later."
        htmlFor="setting-theme"
      >
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger id="setting-theme" className="w-full h-10">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>

      <SettingsField
        label="Room name"
        description="Friendly label for this LAN room, shown in onboarding and network info."
        htmlFor="setting-room-name"
      >
        <Input
          id="setting-room-name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Local Network"
          maxLength={64}
          className="h-10"
        />
      </SettingsField>
    </SectionCard>
  );
}
