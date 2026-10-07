import React, { useEffect, useRef, useState } from "react";
import { RIWAYAS } from "../data/corpora";
import type { AyahReciter, Riwaya, SurahTimings } from "../types";

export interface PlayerBarProps {
  reciters: AyahReciter[];
  reciter: number;
  onReciter: (id: number) => void;
  /** Mode de lecture courant (plan 3, T7) : Warsh ou Hafs. */
  riwaya: Riwaya;
  onRiwaya: (riwaya: Riwaya) => void;
  playing: boolean;
  currentIndex: number;
  totalAyat: number;
  repeat: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Saut direct au verset saisi dans la jauge de position (1-based). */
  onSeek: (ayahNum: number) => void;
  onToggleRepeat: () => void;
  timings?: SurahTimings | null;
}

export function PlayerBar({
  reciters,
  reciter,
  onReciter,
  riwaya,
  onRiwaya,
  playing,
  currentIndex,
  totalAyat,
  repeat,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onSeek,
  onToggleRepeat,
  timings,
}: PlayerBarProps) {
  const currentVerseNum = totalAyat > 0 ? currentIndex + 1 : 0;

  // Saisie en cours dans la jauge ; null = afficher le verset courant.
  const [draft, setDraft] = useState<string | null>(null);
  const positionRef = useRef<HTMLInputElement>(null);

  // L'evenement change NATIF (fleches +/-, perte de focus, Entree) engage le
  // saut. Le onChange de React suit aussi chaque frappe : il ne sert qu'au
  // brouillon, sinon taper « 12 » sauterait d'abord au verset 1.
  useEffect(() => {
    const input = positionRef.current;
    if (!input) return;
    const commit = () => {
      const raw = input.value.trim();
      setDraft(null);
      const n = Math.trunc(Number(raw));
      if (raw === "" || !Number.isFinite(n)) return;
      onSeek(Math.min(totalAyat, Math.max(1, n)));
    };
    input.addEventListener("change", commit);
    return () => input.removeEventListener("change", commit);
  }, [totalAyat, onSeek]);

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
      {/* Plan 3, T7 : le selecteur de mode passe avant le recitant, c'est lui
          qui determine la liste que le select suivant affiche. */}
      <select
        id="riwaya-select"
        name="riwaya"
        data-testid="player-riwaya"
        aria-label="Lecture"
        title="Lecture"
        value={riwaya}
        onChange={(e) => onRiwaya(e.currentTarget.value as Riwaya)}
      >
        {RIWAYAS.map((r) => (
          <option key={r} value={r}>
            {r === "warsh" ? "Warsh" : "Hafs"}
          </option>
        ))}
      </select>

      {/* Une seule voix en Warsh : afficher un select a une option n'explique
          rien. Les 7 recitants Hafs meritent le choix. */}
      {reciters.length > 1 && (
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
        {totalAyat > 0 ? (
          <>
            <input
              ref={positionRef}
              id="position-input"
              name="position"
              type="number"
              inputMode="numeric"
              min={1}
              max={totalAyat}
              step={1}
              aria-label="Aller au verset"
              title="Aller au verset"
              value={draft ?? String(currentVerseNum)}
              onChange={(e) => {
                if (e.nativeEvent.type === "input") setDraft(e.currentTarget.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onBlur={() => setDraft(null)}
            />
            {` / ${totalAyat}`}
          </>
        ) : (
          "—"
        )}
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
