"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SettingsFieldProps {
  /** Label shown on the left (or above on mobile). */
  label: string;
  /** Optional helper / description text under the label. */
  description?: string;
  /** The control element (input, switch, select, …). */
  children: React.ReactNode;
  /** Optional html id for the control so the label can target it. */
  htmlFor?: string;
  /** Extra classes on the row wrapper. */
  className?: string;
  /** Hide the row border (useful inside dense lists). */
  flush?: boolean;
}

/**
 * A responsive label + control row used by every settings section.
 * - Desktop: two-column grid (label/description left, control right-aligned).
 * - Mobile: stacks vertically (label first, control below).
 */
export function SettingsField({
  label,
  description,
  children,
  htmlFor,
  className,
  flush = false,
}: SettingsFieldProps) {
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-4 sm:items-center py-4",
        !flush && "border-b border-border last:border-0",
        className
      )}
    >
      <div className="space-y-0.5 min-w-0">
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium leading-tight text-foreground"
        >
          {label}
        </label>
        {description ? (
          <p className="text-xs text-muted-foreground leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      <div className="sm:justify-self-stretch min-w-0">{children}</div>
    </div>
  );
}
