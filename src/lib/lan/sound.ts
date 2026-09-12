"use client";

// Lightweight sound notifications using the Web Audio API (no asset files needed).
// Generates a short, pleasant tone for incoming messages and a different tone for files.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

// Play a short tone with a given frequency + duration.
function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.06) {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") void c.resume();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(c.destination);
    const now = c.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch {
    /* ignore */
  }
}

// A soft two-note "ding" for incoming chat messages.
export function playMessageSound() {
  tone(880, 120, "sine", 0.05);
  setTimeout(() => tone(1320, 160, "sine", 0.045), 90);
}

// A brighter three-note chime for incoming files.
export function playFileSound() {
  tone(660, 100, "triangle", 0.05);
  setTimeout(() => tone(880, 100, "triangle", 0.05), 80);
  setTimeout(() => tone(1100, 200, "triangle", 0.045), 160);
}
