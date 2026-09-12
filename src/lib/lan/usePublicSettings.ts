"use client";

import { useEffect } from "react";
import { useLanStore } from "./store";
import { lanSocket } from "./socketManager";
import type { PublicSettings } from "./types";

// Fetches public settings on mount and refetches whenever the realtime service
// broadcasts a `settings:updated` event (admin changed a setting). Returns nothing
// — components just read `useLanStore(s => s.publicSettings)`.
export function usePublicSettings() {
  const setPublicSettings = useLanStore((s) => s.setPublicSettings);

  const fetchOnce = async () => {
    try {
      const res = await fetch("/api/settings/public", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { settings: PublicSettings };
        if (data.settings) setPublicSettings(data.settings);
      }
    } catch {
      /* ignore — degrade to defaults */
    }
  };

  useEffect(() => {
    fetchOnce();
    const socket = lanSocket.get();
    const onUpdated = () => fetchOnce();
    if (socket) {
      socket.on("settings:updated", onUpdated);
    }
    // Re-bind after (re)connect — the socket may connect after this hook mounts.
    const checkSocket = lanSocket.get();
    if (checkSocket && !checkSocket.hasListeners?.("settings:updated")) {
      checkSocket.on("settings:updated", onUpdated);
    }
    return () => {
      const s = lanSocket.get();
      s?.off("settings:updated", onUpdated);
    };
  }, [setPublicSettings]);

  // Also refetch when the socket (re)connects.
  useEffect(() => {
    const socket = lanSocket.get();
    if (!socket) return;
    const onConnect = () => fetchOnce();
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [setPublicSettings]);
}
