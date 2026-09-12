"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Shuffle, Wifi, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeviceAvatar } from "./DeviceAvatar";
import { useLanStore } from "@/lib/lan/store";
import {
  colorForSeed,
  detectDeviceType,
  generateDefaultName,
  getOrCreateDeviceId,
} from "@/lib/lan/device";
import { toast } from "sonner";

export function Onboarding() {
  const completeOnboarding = useLanStore((s) => s.completeOnboarding);
  const [name, setName] = useState("");
  const [deviceType] = useState<ReturnType<typeof detectDeviceType>>(() =>
    detectDeviceType(
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    )
  );

  useEffect(() => {
    setName(generateDefaultName(deviceType));
  }, [deviceType]);

  const deviceId = typeof window !== "undefined" ? getOrCreateDeviceId() : "";
  const avatarColor = colorForSeed(deviceId || name || "anon");

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please enter a display name");
      return;
    }
    completeOnboarding({
      deviceId: deviceId || `dev_${Math.random().toString(36).slice(2)}`,
      name: trimmed.slice(0, 32),
      deviceType,
      avatarColor,
      onboarded: true,
    });
    toast.success(`Welcome, ${trimmed}!`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-gradient bg-grid">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md animate-slide-up">
          {/* Brand header */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="h-11 w-11 rounded-2xl bg-brand text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/30">
              <Wifi className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight">LAN Share</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">
                Files & chat for your network
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-xl p-6 sm:p-7 space-y-6">
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-semibold">Join your local network</h2>
              <p className="text-sm text-muted-foreground">
                Pick a display name so others can recognize you.
              </p>
            </div>

            {/* Avatar preview */}
            <div className="flex flex-col items-center gap-2">
              <DeviceAvatar
                name={name || "?"}
                color={avatarColor}
                deviceType={deviceType}
                online={false}
                size="xl"
                showStatus={false}
              />
              <span className="text-xs text-muted-foreground capitalize">
                Detected as {deviceType}
              </span>
            </div>

            {/* Name input */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Display name
              </label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="e.g. Alex's Laptop"
                  maxLength={32}
                  autoFocus
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => setName(generateDefaultName(deviceType))}
                  title="Random name"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={handleJoin}
              className="w-full h-11 text-base bg-brand hover:bg-brand/90 text-brand-foreground"
              size="lg"
            >
              Enter the network
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <Feature icon={<Zap className="h-4 w-4" />} label="Real-time" />
              <Feature icon={<ShieldCheck className="h-4 w-4" />} label="LAN only" />
              <Feature icon={<Wifi className="h-4 w-4" />} label="No install" />
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6 px-4">
            Your name is stored only in this browser. Other devices on the same
            network will see you when you join.
          </p>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
