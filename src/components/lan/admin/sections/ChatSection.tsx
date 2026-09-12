"use client";

import * as React from "react";
import {
  MessageSquare,
  Save,
  Loader2,
  RotateCcw,
  Users,
  User,
  History,
  Type,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ChatSectionProps {
  settings: AdminSettings;
  updateSettings: (partial: Record<string, string>) => Promise<void>;
}

export function ChatSection({ settings, updateSettings }: ChatSectionProps) {
  const initialGroup = (settings["chat.groupEnabled"] ?? "true") === "true";
  const initialPrivate = (settings["chat.privateEnabled"] ?? "true") === "true";
  const initialHistoryMode = settings["chat.historyMode"] ?? "forever";
  const initialHistoryDays = settings["chat.historyDays"] ?? "30";
  const initialMaxLen = settings["chat.maxMessageLength"] ?? "0";
  const initialTyping = (settings["chat.typingIndicator"] ?? "true") === "true";

  const [group, setGroup] = React.useState(initialGroup);
  const [priv, setPriv] = React.useState(initialPrivate);
  const [historyMode, setHistoryMode] = React.useState(initialHistoryMode);
  const [historyDays, setHistoryDays] = React.useState(initialHistoryDays);
  const [maxLen, setMaxLen] = React.useState(initialMaxLen);
  const [typing, setTyping] = React.useState(initialTyping);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setGroup((settings["chat.groupEnabled"] ?? "true") === "true");
    setPriv((settings["chat.privateEnabled"] ?? "true") === "true");
    setHistoryMode(settings["chat.historyMode"] ?? "forever");
    setHistoryDays(settings["chat.historyDays"] ?? "30");
    setMaxLen(settings["chat.maxMessageLength"] ?? "0");
    setTyping((settings["chat.typingIndicator"] ?? "true") === "true");
  }, [settings]);

  const dirty = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (group !== initialGroup)
      out["chat.groupEnabled"] = group ? "true" : "false";
    if (priv !== initialPrivate)
      out["chat.privateEnabled"] = priv ? "true" : "false";
    if (historyMode !== initialHistoryMode)
      out["chat.historyMode"] = historyMode;
    if (historyDays !== initialHistoryDays)
      out["chat.historyDays"] = historyDays;
    if (maxLen !== initialMaxLen) out["chat.maxMessageLength"] = maxLen;
    if (typing !== initialTyping)
      out["chat.typingIndicator"] = typing ? "true" : "false";
    return out;
  }, [
    group,
    priv,
    historyMode,
    historyDays,
    maxLen,
    typing,
    initialGroup,
    initialPrivate,
    initialHistoryMode,
    initialHistoryDays,
    initialMaxLen,
    initialTyping,
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
    setGroup(initialGroup);
    setPriv(initialPrivate);
    setHistoryMode(initialHistoryMode);
    setHistoryDays(initialHistoryDays);
    setMaxLen(initialMaxLen);
    setTyping(initialTyping);
    toast.message("Reverted unsaved changes");
  };

  return (
    <SectionCard
      title="Chat"
      description="Group/private chat toggles, history retention, and message limits."
      icon={<MessageSquare className="h-4 w-4" />}
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
        label="Group chat"
        description="Let every connected device chat together in one shared room."
      >
        <div className="flex items-center justify-between gap-3 h-10">
          <Switch
            checked={group}
            onCheckedChange={setGroup}
            aria-label="Toggle group chat"
          />
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Badge variant={group ? "default" : "secondary"}>
              {group ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </SettingsField>

      <SettingsField
        label="Private chat"
        description="Allow 1-to-1 direct messaging between two devices."
      >
        <div className="flex items-center justify-between gap-3 h-10">
          <Switch
            checked={priv}
            onCheckedChange={setPriv}
            aria-label="Toggle private chat"
          />
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Badge variant={priv ? "default" : "secondary"}>
              {priv ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </SettingsField>

      <SettingsField
        label="History retention"
        description="How long chat messages are kept after they're sent."
        htmlFor="setting-history-mode"
      >
        <Select value={historyMode} onValueChange={setHistoryMode}>
          <SelectTrigger id="setting-history-mode" className="w-full h-10">
            <SelectValue placeholder="Select retention" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="forever">Forever — keep all</SelectItem>
            <SelectItem value="clearOnRestart">
              Clear on server restart
            </SelectItem>
            <SelectItem value="days">Keep last N days</SelectItem>
          </SelectContent>
        </Select>
      </SettingsField>

      {historyMode === "days" ? (
        <SettingsField
          label="Keep messages for (days)"
          description="Messages older than this are pruned."
          htmlFor="setting-history-days"
        >
          <div className="flex items-center gap-2">
            <Input
              id="setting-history-days"
              type="number"
              min={1}
              value={historyDays}
              onChange={(e) => setHistoryDays(e.target.value)}
              className="h-10"
            />
            <History className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </SettingsField>
      ) : null}

      <SettingsField
        label="Max message length"
        description="Reject messages longer than this. 0 = unlimited."
        htmlFor="setting-max-len"
      >
        <div className="flex items-center gap-2">
          <Input
            id="setting-max-len"
            type="number"
            min={0}
            value={maxLen}
            onChange={(e) => setMaxLen(e.target.value)}
            className="h-10"
          />
          <Type className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </SettingsField>

      <SettingsField
        label="Typing indicator"
        description="Show “typing…” hints to the other party in private chats."
      >
        <div className="flex items-center justify-between gap-3 h-10">
          <Switch
            checked={typing}
            onCheckedChange={setTyping}
            aria-label="Toggle typing indicator"
          />
          <PenLine
            className={
              typing
                ? "h-4 w-4 text-brand"
                : "h-4 w-4 text-muted-foreground/40"
            }
          />
        </div>
      </SettingsField>
    </SectionCard>
  );
}
