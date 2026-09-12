"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "@/components/lan/Onboarding";
import { AppShell } from "@/components/lan/AppShell";
import { useLanStore } from "@/lib/lan/store";

export default function Home() {
  const self = useLanStore((s) => s.self);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Zustand persist hydrates synchronously from localStorage; this flag
    // prevents a server/client hydration mismatch on the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Avoid hydration flash before persisted state loads.
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand text-brand-foreground flex items-center justify-center animate-pulse">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">Starting LAN Share…</p>
        </div>
      </div>
    );
  }

  if (!self?.onboarded) {
    return <Onboarding />;
  }

  return <AppShell />;
}
