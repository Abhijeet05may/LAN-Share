"use client";

import * as React from "react";
import { AdminLogin } from "@/components/lan/admin/AdminLogin";
import { AdminPanel } from "@/components/lan/admin/AdminPanel";
import { Skeleton } from "@/components/ui/skeleton";

interface SessionState {
  authenticated: boolean;
  isDefaultPassword: boolean;
}

export default function AdminPage() {
  const [session, setSession] = React.useState<SessionState | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { cache: "no-store" });
      if (!res.ok) {
        setSession({ authenticated: false, isDefaultPassword: false });
        return;
      }
      const data = (await res.json()) as Partial<SessionState>;
      setSession({
        authenticated: !!data.authenticated,
        isDefaultPassword: !!data.isDefaultPassword,
      });
    } catch {
      setSession({ authenticated: false, isDefaultPassword: false });
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="h-1 w-full bg-brand" aria-hidden />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-11 w-11 rounded-2xl mx-auto" />
            <Skeleton className="h-6 w-40 mx-auto" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <AdminLogin
        isDefaultPassword={session.isDefaultPassword}
        onAuthenticated={() => void refresh()}
      />
    );
  }

  return <AdminPanel onLogout={() => void refresh()} />;
}
