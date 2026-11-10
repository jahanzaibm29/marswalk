"use client";

import { MapPin } from "lucide-react";
import type { ScientificPOI } from "@/types/poi";

interface Props {
  pois: ScientificPOI[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function PoiList({ pois, selectedId, onSelect }: Props) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mars-200">
        <MapPin size={14} /> Points of interest
      </h2>
      <ul className="space-y-0.5">
        {pois.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-white/10 ${
                p.id === selectedId ? "bg-mars-500/25 text-white" : "text-white/80"
              }`}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
