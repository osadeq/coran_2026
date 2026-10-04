import React from "react";
import type { AyahReciter, SurahTimings } from "../types";

export interface PlayerBarProps {
  reciters: AyahReciter[];
  reciter: number;
  onReciter: (id: number) => void;
  playing: boolean;
  currentIndex: number;
  totalAyat: number;
  repeat: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRepeat: () => void;
  timings?: SurahTimings | null;
}

export function PlayerBar({
  reciters,
  reciter,
  onReciter,
  playing,
  currentIndex,
  totalAyat,
  repeat,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onToggleRepeat,
  timings,
}: PlayerBarProps) {
  const currentVerseNum = totalAyat > 0 ? currentIndex + 1 : 0;

  const calculateProgressPercent = (): number => {
    if (!totalAyat) return 0;
    if (timings && timings.ayat && timings.ayat.length > 0) {
      const totalDuration = timings.durationMs || 1;
      const currentTiming = timings.ayat[currentIndex];
      const startMs = currentTiming ? currentTiming[1] : (currentIndex / totalAyat) * totalDuration;
      return Math.min(100, Math.max(0, Math.round((startMs / totalDuration) * 100)));
    }
    return Math.min(100, Math.max(0, Math.round((currentVerseNum / totalAyat) * 100)));
  };

  const progressPercent = calculateProgressPercent();

  return (
    <div className="player" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 16px" }}>
      {reciters.length > 0 && (
        <select
          data-testid="player-reciter"
          aria-label="Récitant"
          value={reciter}
          onChange={(e) => onReciter(Number(e.currentTarget.value))}
        >
          {reciters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.labelFr}
            </option>
          ))}
        </select>
      )}

      <button
        data-testid="player-prev"
        type="button"
        onClick={onPrev}
        aria-label="Précédent"
      >
        ⏮
      </button>

      <button
        data-testid="player-play"
        type="button"
        onClick={playing ? onPause : onPlay}
        aria-label={playing ? "Pause" : "Lire"}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <button
        data-testid="player-next"
        type="button"
        onClick={onNext}
        aria-label="Suivant"
      >
        ⏭
      </button>

      <button
        data-testid="player-repeat"
        type="button"
        onClick={onToggleRepeat}
        aria-pressed={repeat}
        aria-label="Répéter"
      >
        🔁
      </button>

      <div data-testid="player-position">
        {totalAyat > 0 ? `${currentVerseNum} / ${totalAyat}` : "—"}
      </div>

      <div
        data-testid="player-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        style={{ flex: 1, background: "#ccc", height: "8px", borderRadius: "4px", overflow: "hidden" }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: "#0070f3",
            transition: "width 0.2s ease",
          }}
        />
      </div>

      {timings && timings.precision !== "exact" && (
        <span className="badge">durées estimées</span>
      )}
    </div>
  );
}
