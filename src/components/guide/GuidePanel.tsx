"use client";

import {
  AlertTriangle, CheckCircle2, Footprints, Info, LocateFixed, Pause, Play, RotateCcw, X,
} from "lucide-react";
import ElevationProfile from "@/components/route/ElevationProfile";
import { RISK } from "@/lib/hazards/risk";
import { EVA } from "@/lib/routing/travel";
import { fmtDistance, fmtDuration } from "@/lib/format";
import { compass, fmtClock, type Cue, type GuidePlan, type GuideState, type Phase, type Severity } from "@/lib/guide/guide";
import { SPEEDS, type Speed } from "@/lib/guide/useGuideSim";

interface Props {
  plan: GuidePlan;
  state: GuideState;
  simH: number;
  playing: boolean;
  speed: Speed;
  follow: boolean;
  onTogglePlay: () => void;
  onSeek: (h: number) => void;
  onReset: () => void;
  onSpeed: (s: Speed) => void;
  onFollow: (f: boolean) => void;
  onExit: () => void;
}

const PHASE_LABEL: Record<Phase, string> = {
  out: "Walking out",
  site: "Science at site",
  back: "Walking back",
  done: "EVA complete",
};

export const SEVERITY_STYLE: Record<Severity, { text: string; border: string; Icon: typeof Info }> = {
  info: { text: "text-sky-300", border: "border-sky-400/40", Icon: Info },
  caution: { text: "text-yellow-300", border: "border-yellow-400/40", Icon: AlertTriangle },
  warning: { text: "text-orange-300", border: "border-orange-400/50", Icon: AlertTriangle },
  success: { text: "text-green-300", border: "border-green-400/40", Icon: CheckCircle2 },
};

export default function GuidePanel(p: Props) {
  const { plan, state } = p;
  const budgetLeft = EVA.maxHours - p.simH;
  const consumables = Math.max(0, budgetLeft / EVA.maxHours);
  const consumablesColor = consumables > 0.4 ? "#22c55e" : consumables > 0.15 ? "#facc15" : "#dc2626";
  const passed = plan.cues.filter((c) => c.atH <= p.simH).reverse();

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mars-200">
          <Footprints size={14} /> Guided walk · {plan.route.label}
        </h2>
        <button
          type="button"
          onClick={p.onExit}
          className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 text-xs text-white/70 hover:bg-white/10"
        >
          <X size={12} /> Exit
        </button>
      </div>
      <p className="-mt-2 truncate text-[11px] text-white/50">
        {plan.startLabel} → {plan.endLabel}
      </p>

      {/* Mission clock */}
      <div className="rounded-md border border-white/10 bg-black/30 p-2">
        <div className="flex items-baseline justify-between">
          <span className="rounded bg-mars-500/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mars-200">
            {PHASE_LABEL[state.phase]}
          </span>
          <span className="font-mono text-lg tabular-nums">
            {fmtClock(p.simH)}
            <span className="text-xs text-white/40"> / {fmtClock(EVA.maxHours)}</span>
          </span>
        </div>
        <div className="mt-2">
          <div className="mb-0.5 flex justify-between text-[10px] text-white/50">
            <span>Suit consumables (est.)</span>
            <span className="font-mono" style={{ color: consumablesColor }}>
              {budgetLeft >= 0 ? `${Math.round(consumables * 100)}% · ${fmtDuration(budgetLeft)} left` : `over by ${fmtDuration(-budgetLeft)}`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full" style={{ width: `${consumables * 100}%`, background: consumablesColor }} />
          </div>
        </div>
      </div>

      {/* Playback */}
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={plan.totalH}
          step={plan.totalH / 1000}
          value={p.simH}
          onChange={(e) => p.onSeek(Number(e.target.value))}
          className="w-full accent-mars-400"
          aria-label="Mission time"
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={p.onTogglePlay}
            className="flex items-center gap-1.5 rounded-md bg-mars-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-mars-400"
          >
            {p.playing ? <Pause size={14} /> : <Play size={14} />}
            {p.playing ? "Pause" : state.phase === "done" ? "Replay" : p.simH > 0 ? "Resume" : "Start"}
          </button>
          <button
            type="button"
            onClick={p.onReset}
            className="rounded-md border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
            title="Back to start"
            aria-label="Back to start"
          >
            <RotateCcw size={14} />
          </button>
          <select
            value={p.speed}
            onChange={(e) => p.onSpeed(Number(e.target.value) as Speed)}
            className="rounded-md border border-white/15 bg-black/40 px-1.5 py-1 text-xs text-white"
            aria-label="Playback speed"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}× speed
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => p.onFollow(!p.follow)}
            aria-pressed={p.follow}
            className={`ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
              p.follow ? "border-mars-400 bg-mars-500/30 text-white" : "border-white/15 text-white/70 hover:bg-white/10"
            }`}
            title="Keep the camera on the astronaut"
          >
            <LocateFixed size={13} /> Follow
          </button>
        </div>
      </div>

      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        {/* Telemetry */}
        <dl className="grid grid-cols-3 gap-x-2 gap-y-1.5 rounded-md border border-white/10 bg-black/30 p-2 text-[11px]">
          <Stat label="Walked" value={fmtDistance(state.walkedM)} />
          <Stat
            label={state.phase === "site" ? "Site time left" : "Leg left"}
            value={state.phase === "site" ? fmtDuration(state.legRemainingH) : fmtDistance(state.legRemainingM)}
          />
          <Stat label="Leg ETA" value={state.phase === "done" ? "—" : fmtDuration(state.legRemainingH)} />
          <Stat label="Elevation" value={`${Math.round(state.z)} m`} />
          <Stat label="Slope" value={`${state.slope.toFixed(1)}°`} />
          <Stat
            label="Heading"
            value={state.speedKmh > 0 ? `${compass(state.headingDeg)} ${Math.round(state.headingDeg)}°` : "—"}
          />
          <Stat label="Pace" value={state.speedKmh > 0 ? `${state.speedKmh.toFixed(1)} km/h` : "—"} />
          <div className="col-span-2">
            <dt className="text-[9px] uppercase tracking-wide text-white/40">Terrain</dt>
            <dd className="font-semibold" style={{ color: RISK.colors[state.cls] }}>
              {RISK.labels[state.cls]} risk
            </dd>
          </div>
        </dl>

        <ElevationProfile profile={plan.route.profile} cursor={{ d: state.d, z: state.z }} />

        {/* Cue log */}
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">Guidance</h3>
          {state.nextCue && (
            <CueRow cue={state.nextCue} simH={p.simH} upcoming onJump={() => p.onSeek(state.nextCue!.atH)} />
          )}
          <ol className="space-y-1">
            {passed.map((c, i) => (
              <li key={`${c.atH}-${i}`}>
                <CueRow cue={c} simH={p.simH} onJump={() => p.onSeek(c.atH)} />
              </li>
            ))}
          </ol>
        </div>

        <p className="text-[10px] leading-snug text-white/35">
          Simulation only. Pace, timings and consumables use the same hypothetical walking model as the planner
          and an assumed {EVA.maxHours} h EVA, not real suit data.
        </p>
      </div>
    </section>
  );
}

function CueRow({ cue, simH, upcoming, onJump }: { cue: Cue; simH: number; upcoming?: boolean; onJump: () => void }) {
  const st = SEVERITY_STYLE[cue.severity];
  return (
    <button
      type="button"
      onClick={onJump}
      className={`mb-1 w-full rounded-md border p-1.5 text-left text-[11px] hover:bg-white/5 ${
        upcoming ? "border-dashed border-white/15 opacity-70" : st.border
      }`}
      title="Jump to this moment"
    >
      <div className="flex items-center gap-1.5">
        <st.Icon size={12} className={`shrink-0 ${st.text}`} />
        <span className={`font-semibold ${st.text}`}>{upcoming ? `Next: ${cue.title}` : cue.title}</span>
        <span className="ml-auto font-mono text-[10px] text-white/40">
          {upcoming ? (cue.atH - simH < 1 / 60 ? "in <1 min" : `in ${fmtDuration(cue.atH - simH)}`) : fmtClock(cue.atH)}
        </span>
      </div>
      <p className="mt-0.5 text-white/75">{cue.text}</p>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wide text-white/40">{label}</dt>
      <dd className="font-mono text-white/90">{value}</dd>
    </div>
  );
}
