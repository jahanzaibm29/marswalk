"use client";

import { Eye, EyeOff, Layers } from "lucide-react";
import { LAYERS } from "@/lib/layers/catalog";
import type { LayerCategory, LayerState, LayerStateMap } from "@/types/layer";

const CATEGORY_LABEL: Record<LayerCategory, string> = {
  safety: "Safety",
  base: "Base maps",
  optical: "High-resolution imagery",
  topography: "Topography",
  thermal: "Thermal",
  spectral: "Spectral / mineralogy",
  mission: "Mission data",
};

const CATEGORY_ORDER: LayerCategory[] = ["safety", "optical", "base", "topography", "thermal", "spectral", "mission"];

interface Props {
  state: LayerStateMap;
  onChange: (id: string, next: Partial<LayerState>) => void;
}

export default function LayerPanel({ state, onChange }: Props) {
  return (
    <section className="flex min-h-0 flex-col">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mars-200">
        <Layers size={14} /> Science layers
      </h2>
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
        {CATEGORY_ORDER.map((cat) => {
          // Show top-most layers first, matching how they stack on the map.
          const items = LAYERS.filter((l) => l.category === cat).reverse();
          if (!items.length) return null;
          return (
            <div key={cat}>
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/50">
                {CATEGORY_LABEL[cat]}
              </h3>
              <ul className="space-y-1.5">
                {items.map((l) => {
                  const st = state[l.id];
                  return (
                    <li key={l.id} className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => onChange(l.id, { visible: !st.visible })}
                          className={`mt-0.5 shrink-0 rounded p-0.5 ${st.visible ? "text-mars-400" : "text-white/40"} hover:bg-white/10`}
                          aria-pressed={st.visible}
                          aria-label={`${st.visible ? "Hide" : "Show"} ${l.name}`}
                        >
                          {st.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium leading-tight">{l.name}</span>
                            {l.kind !== "vector" && (
                              <span className="shrink-0 font-mono text-[10px] text-white/50">{l.resolution}</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-white/55">{l.description}</p>
                          <p className="mt-0.5 text-[10px] text-white/35">
                            {l.source.mission} · {l.source.instrument}
                          </p>
                          {l.kind === "hazard" && (
                            <ul className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                              {l.legend.map((item) => (
                                <li key={item.label} className="flex items-center gap-1.5 text-[10px] text-white/60">
                                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: item.color }} />
                                  {item.label}
                                </li>
                              ))}
                            </ul>
                          )}
                          {l.kind !== "vector" && st.visible && (
                            <label className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
                              Opacity
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={st.opacity}
                                onChange={(e) => onChange(l.id, { opacity: Number(e.target.value) })}
                                className="h-1 flex-1"
                              />
                              <span className="w-7 text-right font-mono">{Math.round(st.opacity * 100)}%</span>
                            </label>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
