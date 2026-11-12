"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Simulated seconds per real second. */
export const SPEEDS = [60, 300, 900, 1800] as const;
export type Speed = (typeof SPEEDS)[number];

/** Mission-clock playback: advances `simH` (hours) in real time × speed. */
export function useGuideSim(totalH: number | null) {
  const [simH, setSimH] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(300);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!playing || totalH == null) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't jump the walker ahead.
      const dt = Math.min(0.25, (now - prev) / 1000);
      prev = now;
      setSimH((h) => {
        const next = Math.min(totalH, h + (dt * speedRef.current) / 3600);
        if (next >= totalH) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalH]);

  const reset = useCallback(() => {
    setSimH(0);
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (totalH == null) return;
    setSimH((h) => (h >= totalH ? 0 : h)); // replay from the start when finished
    setPlaying((p) => !p);
  }, [totalH]);

  const seek = useCallback(
    (h: number) => setSimH(totalH == null ? 0 : Math.max(0, Math.min(totalH, h))),
    [totalH],
  );

  return { simH, playing, speed, setSpeed, togglePlay, seek, reset, setPlaying };
}
