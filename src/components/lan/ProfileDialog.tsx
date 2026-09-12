"use client";

import { useState } from "react";
import { User, Shuffle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DeviceAvatar } from "./DeviceAvatar";
import { useLanStore } from "@/lib/lan/store";
import { lanSocket } from "@/lib/lan/socketManager";
import {
  colorForSeed,
  generateDefaultName,
  detectDeviceType,
} from "@/lib/lan/device";
import { toast } from "sonner";

const AVATAR_PALETTE = [
  "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
  "#84cc16", "#a855f7",
];

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const self = useLanStore((s) => s.self);
  const setSelf = useLanStore((s) => s.setSelf);
  // Lazy initializers — read the current self values when the component first
  // mounts (the parent uses `key` to remount on each open, so these are fresh).
  const [name, setName] = useState(self?.name || "");
  const [color, setColor] = useState(self?.avatarColor || "#10b981");

  if (!self) return null;

  const deviceType = self.deviceType;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Display name cannot be empty");
      return;
    }
    const updated = {
      ...self,
      name: trimmed.slice(0, 32),
      avatarColor: color,
    };
    setSelf(updated);
    // Re-join the socket with the updated profile so other devices see the change.
    const socket = lanSocket.get();
    if (socket?.connected) {
      socket.emit("device:join", {
        deviceId: updated.deviceId,
        name: updated.name,
        deviceType: updated.deviceType,
        userAgent: navigator.userAgent,
        avatarColor: updated.avatarColor,
        roomPin: updated.roomPin || "",
      });
    }
    toast.success("Profile updated");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Change your display name and avatar color. Other devices will see
            the update immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-2">
            <DeviceAvatar
              name={name || "?"}
              color={color}
              deviceType={deviceType}
              online
              size="xl"
            />
            <span className="text-xs text-muted-foreground">Preview</span>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="profile-name" className="text-sm font-medium">
              Display name
            </label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                maxLength={32}
                className="h-10"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setName(generateDefaultName(deviceType))}
                title="Random name"
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Avatar color</label>
            <div className="grid grid-cols-5 gap-2">
              {AVATAR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`Color ${c}`}
                >
                  {color === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-brand hover:bg-brand/90 text-brand-foreground"
          >
            <Check className="h-4 w-4 mr-1.5" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
