"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AdminLoginProps {
  /** Whether the backend reports the default password is still in use. */
  isDefaultPassword: boolean;
  /** Called once the login POST succeeds. */
  onAuthenticated: () => void;
}

export function AdminLogin({
  isDefaultPassword,
  onAuthenticated,
}: AdminLoginProps) {
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = password;
    if (!pw) {
      toast.error("Please enter the admin password");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        toast.success("Welcome back, admin");
        onAuthenticated();
      } else {
        const data = await res.json().catch(() => ({ error: "Login failed" }));
        toast.error(data.error || "Invalid password");
      }
    } catch (err) {
      toast.error("Network error — could not reach the server");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-gradient bg-grid">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-brand" aria-hidden />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md animate-slide-up">
          {/* Brand header */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="h-11 w-11 rounded-2xl bg-brand text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                Admin Console
              </h1>
              <p className="text-xs text-muted-foreground -mt-0.5">
                LAN Share management
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-xl p-6 sm:p-7 space-y-5">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold">Unlock admin access</h2>
              <p className="text-sm text-muted-foreground">
                Enter your admin password to manage devices, settings, and
                network policy.
              </p>
            </div>

            {isDefaultPassword ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed">
                  You&apos;re using the default password (
                  <code className="font-mono">admin</code>). Change it
                  immediately after logging in.
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-password">Admin password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    autoComplete="current-password"
                    className="h-11 pl-9 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={show ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {show ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base bg-brand hover:bg-brand/90 text-brand-foreground"
                size="lg"
                disabled={loading || !password}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unlocking…
                  </>
                ) : (
                  "Unlock Admin"
                )}
              </Button>
            </form>

            <div className="pt-2 border-t text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to app
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6 px-4">
            Admin sessions use a sliding 24-hour cookie. Only the host machine
            can reach this panel.
          </p>
        </div>
      </main>
    </div>
  );
}
