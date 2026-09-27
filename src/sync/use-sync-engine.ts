import { useEffect, useRef } from "react";
import type { TimingRow } from "../types";
import { findAyahAt } from "./timing-index";

export function useSyncEngine(
  audio: HTMLAudioElement | null,
  rows: readonly TimingRow[],
  onAyah: (ayah: number | null) => void,
): void {
  const last = useRef<number | null>(null);
  const callback = useRef(onAyah);
  callback.current = onAyah;

  useEffect(() => {
    if (!audio) return;
    let frame = 0;
    const tick = () => {
      const current = findAyahAt(rows, audio.currentTime * 1000);
      if (current !== last.current) {
        last.current = current;
        callback.current(current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      last.current = null;
    };
  }, [audio, rows]);
}
