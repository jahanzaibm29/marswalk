"use client";

import { Pause, Play } from "lucide-react";
import { SEVERITY_STYLE } from "@/components/guide/GuidePanel";
import type { Cue } from "@/lib/guide/guide";
import { fmtClock } from "@/lib/guide/guide";

/** Latest guidance cue, shown over the map during a guided walk. */
export default function GuideBanner({
  cue, simH, playing, onTogglePlay,
}: { cue: Cue | null; simH: number; playing: boolean; onTogglePlay: () => void }) {
  if (!cue) return null;
  const st = SEVERITY_STYLE[cue.severity];
  return (
    <div
      className={`pointer-events-auto flex w-[min(30rem,calc(100vw-1.5rem))] items-start gap-2 rounded-lg border bg-panel p-2.5 shadow-2xl backdrop-blur ${st.border}`}
      role="status"
      aria-live="polite"
    >
      <st.Icon size={18} className={`mt-0.5 shrink-0 ${st.text}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-semibold ${st.text}`}>{cue.title}</span>
          <span className="ml-auto font-mono text-[11px] text-white/50">EVA {fmtClock(simH)}</span>
        </div>
        <p className="text-xs leading-snug text-white/85">{cue.text}</p>
      </div>
      <button
        type="button"
        onClick={onTogglePlay}
        className="shrink-0 rounded-md border border-white/15 p-1.5 text-white/80 hover:bg-white/10"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
    </div>
  );
}
