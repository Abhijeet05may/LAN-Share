"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Render with a danger (red-accent) top border to mark destructive areas. */
  danger?: boolean;
}

/**
 * Reusable card wrapper for an admin settings section.
 * Provides a consistent header (icon + title + description), content area,
 * and optional footer (typically used for a "Save changes" button).
 */
export function SectionCard({
  title,
  description,
  icon,
  footer,
  children,
  className,
  contentClassName,
  danger = false,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "py-0 gap-0 overflow-hidden",
        danger && "border-destructive/40",
        className
      )}
    >
      {danger ? (
        <div className="h-1 w-full bg-destructive" aria-hidden />
      ) : null}
      <CardHeader
        className={cn(
          "pt-5 pb-3 gap-1.5",
          danger && "[&_[data-slot=card-title]]:text-destructive"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon ? (
            <div
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
                danger
                  ? "bg-destructive/10 text-destructive"
                  : "bg-brand/10 text-brand"
              )}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-0.5 truncate">
                {description}
              </CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("px-5 pb-5", contentClassName)}>
        {children}
      </CardContent>
      {footer ? (
        <CardFooter className="border-t bg-muted/30 py-3 justify-end gap-2">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
