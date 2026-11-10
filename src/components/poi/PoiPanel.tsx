"use client";

import { ExternalLink, X } from "lucide-react";
import type { ScientificPOI } from "@/types/poi";

interface Props {
  poi: ScientificPOI;
  onClose: () => void;
}

export default function PoiPanel({ poi, onClose }: Props) {
  return (
    <aside className="flex max-h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-panel shadow-2xl backdrop-blur">
      <header className="flex items-start justify-between gap-2 border-b border-white/10 p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mars-400">{poi.category}</p>
          <h2 className="text-base font-semibold leading-tight">{poi.name}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-white/50">
            {poi.lat.toFixed(4)}°N, {poi.lon.toFixed(4)}°E
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </header>
      <div className="space-y-3 overflow-y-auto p-3 text-sm">
        {poi.importance && (
          <p className="rounded-md border border-mars-500/40 bg-mars-500/10 p-2 text-[13px] text-mars-50">
            {poi.importance}
          </p>
        )}
        <p className="leading-relaxed text-white/80">{poi.description}</p>
        {poi.images.map((img) => (
          <figure key={img.url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={poi.name} className="w-full rounded-md border border-white/10" loading="lazy" />
            <figcaption className="mt-1 text-[10px] text-white/40">{img.credit}</figcaption>
          </figure>
        ))}
        <a
          href={poi.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-mars-200 hover:underline"
        >
          Source: {poi.source.label} <ExternalLink size={11} />
        </a>
      </div>
    </aside>
  );
}
