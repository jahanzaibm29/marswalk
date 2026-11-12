"use client";

import { RISK } from "@/lib/hazards/risk";
import { fmtDistance } from "@/lib/format";
import type { ProfilePoint } from "@/types/route";

const W = 300;
const H = 96;
const PAD = { l: 34, r: 6, t: 6, b: 16 };

/** Elevation along the route, coloured by terrain risk. */
export default function ElevationProfile({
  profile,
  cursor,
}: {
  profile: ProfilePoint[];
  /** Current position (distance m, elevation m) to mark, e.g. in Guide Mode. */
  cursor?: { d: number; z: number };
}) {
  if (profile.length < 2) return null;
  const total = profile[profile.length - 1].d;
  const zs = profile.map((p) => p.z);
  let zMin = Math.min(...zs);
  let zMax = Math.max(...zs);
  if (zMax - zMin < 20) {
    const mid = (zMax + zMin) / 2;
    zMin = mid - 10;
    zMax = mid + 10;
  }
  const x = (d: number) => PAD.l + (d / total) * (W - PAD.l - PAD.r);
  const y = (z: number) => PAD.t + (1 - (z - zMin) / (zMax - zMin)) * (H - PAD.t - PAD.b);

  const area =
    `M${x(0)},${H - PAD.b} ` +
    profile.map((p) => `L${x(p.d).toFixed(1)},${y(p.z).toFixed(1)}`).join(" ") +
    ` L${x(total)},${H - PAD.b} Z`;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Elevation profile along route">
        <path d={area} fill="rgb(255 255 255 / 0.06)" />
        {profile.slice(1).map((p, i) => {
          const a = profile[i];
          return (
            <line
              key={i}
              x1={x(a.d)}
              y1={y(a.z)}
              x2={x(p.d)}
              y2={y(p.z)}
              stroke={RISK.colors[p.cls]}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
        <g className="fill-white/50 font-mono" fontSize={8}>
          <text x={PAD.l - 4} y={y(zMax) + 3} textAnchor="end">{Math.round(zMax)}</text>
          <text x={PAD.l - 4} y={y(zMin) + 3} textAnchor="end">{Math.round(zMin)}</text>
          <text x={PAD.l} y={H - 4}>0</text>
          <text x={W - PAD.r} y={H - 4} textAnchor="end">{fmtDistance(total)}</text>
        </g>
        {cursor && (
          <g>
            <line
              x1={x(cursor.d)}
              y1={PAD.t}
              x2={x(cursor.d)}
              y2={H - PAD.b}
              stroke="rgb(255 255 255 / 0.5)"
              strokeDasharray="2 2"
            />
            <circle cx={x(cursor.d)} cy={y(Math.max(zMin, Math.min(zMax, cursor.z)))} r={3.5} fill="#fff" stroke="#e07a4a" strokeWidth={2} />
          </g>
        )}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="rgb(255 255 255 / 0.2)" />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="rgb(255 255 255 / 0.2)" />
      </svg>
      <figcaption className="text-[10px] text-white/40">Elevation (m) along route, coloured by terrain risk</figcaption>
    </figure>
  );
}
