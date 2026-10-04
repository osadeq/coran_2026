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
    <div className="player">
      {reciters.length > 0 && (
        <select
          id="reciter-select"
          name="reciter"
          data-testid="player-reciter"
          aria-label="Récitant"
          title="Récitant"
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
        title="Verset précédent"
      >
        ⏮
      </button>

      <button
        data-testid="player-play"
        type="button"
        onClick={playing ? onPause : onPlay}
        aria-label={playing ? "Pause" : "Lire"}
        title={playing ? "Pause" : "Lire"}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <button
        data-testid="player-next"
        type="button"
        onClick={onNext}
        aria-label="Suivant"
        title="Verset suivant"
      >
        ⏭
      </button>

      <button
        data-testid="player-repeat"
        type="button"
        onClick={onToggleRepeat}
        aria-pressed={repeat}
        aria-label="Répéter"
        title="Répéter la sourate"
      >
        🔁
      </button>

      <div className="player-position" data-testid="player-position">
        {totalAyat > 0 ? `${currentVerseNum} / ${totalAyat}` : "—"}
      </div>

      <div
        className="player-progress"
        data-testid="player-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <div className="player-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {timings && timings.precision !== "exact" && (
        <span className="badge">durées estimées</span>
      )}
    </div>
  );
}
