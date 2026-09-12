"use client";

import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";

// A small curated set of emojis grouped by category. Keeps the bundle tiny
// (no external emoji-mart dependency) while covering the common cases.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
      "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
      "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
      "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙",
      "👈", "👉", "👆", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖",
      "👏", "🙌", "👐", "🤲", "🙏", "✍️", "💪", "🦾", "🦿", "🦵",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "💻", "📱", " tablet", "⌨️", "🖱️", "💽", "💾", "💿", "📀", "📷",
      "📹", "🎥", "📞", "☎️", "📟", "📠", "📺", "📻", "⏰", "⏱️",
      "📁", "📂", "🗂️", "📄", "📃", "📝", "📰", "📑", "🔖", "🏷️",
    ],
  },
  {
    label: "Symbols",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "✅",
      "❌", "⭕", "🔴", "🟢", "🟡", "🔵", "⚡", "🔥", "✨", "🌟",
    ],
  },
];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={() => setOpen((v) => !v)}
        aria-label="Emoji picker"
        title="Emoji"
      >
        <Smile className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border bg-popover shadow-xl z-30 animate-slide-up overflow-hidden">
          {/* Category tabs */}
          <div className="flex border-b">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setGroup(i)}
                className={
                  "flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors " +
                  (group === i
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:bg-muted")
                }
              >
                {g.label}
              </button>
            ))}
          </div>
          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto scrollbar-thin">
            {EMOJI_GROUPS[group].emojis.map((e, idx) => (
              <button
                key={`${e}-${idx}`}
                onClick={() => {
                  onPick(e);
                  setOpen(false);
                }}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-lg leading-none transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
