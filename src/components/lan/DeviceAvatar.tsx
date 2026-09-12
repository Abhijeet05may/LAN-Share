"use client";

import { Laptop, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/lan/device";
import type { DeviceType } from "@/lib/lan/types";

interface DeviceAvatarProps {
  name: string;
  color: string;
  deviceType?: DeviceType;
  online?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  className?: string;
}

const SIZES: Record<NonNullable<DeviceAvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

const STATUS_SIZES: Record<NonNullable<DeviceAvatarProps["size"]>, string> = {
  sm: "h-2.5 w-2.5 ring-2",
  md: "h-3 w-3 ring-2",
  lg: "h-3.5 w-3.5 ring-2",
  xl: "h-4 w-4 ring-[3px]",
};

function DeviceIcon({ type, className }: { type: DeviceType; className?: string }) {
  if (type === "mobile") return <Smartphone className={className} />;
  if (type === "tablet") return <Tablet className={className} />;
  return <Laptop className={className} />;
}

export function DeviceAvatar({
  name,
  color,
  deviceType = "desktop",
  online = false,
  size = "md",
  showStatus = true,
  className,
}: DeviceAvatarProps) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full font-semibold text-white shadow-sm select-none",
          SIZES[size]
        )}
        style={{ backgroundColor: color }}
      >
        <span className="tracking-tight">{initialsOf(name)}</span>
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-black/30 backdrop-blur-sm p-0.5">
          <DeviceIcon
            type={deviceType}
            className="h-2.5 w-2.5 text-white"
          />
        </div>
      </div>
      {showStatus && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 rounded-full ring-background",
            STATUS_SIZES[size],
            online ? "bg-[var(--online)] animate-pulse-dot" : "bg-muted-foreground/40"
          )}
        />
      )}
    </div>
  );
}
