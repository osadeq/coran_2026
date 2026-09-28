import { useEffect, useState } from "react";
import type { Reciter, SurahTimings, TimingRow } from "../types";
import { useSyncEngine } from "../sync/use-sync-engine";

interface Props {
  timings: SurahTimings | null;
  audioUrl: string;
  reciters: Reciter[];
  reciter: number;
  onReciter: (id: number) => void;
  onAyah: (ayah: number | null) => void;
  play?: () => Promise<void>;
  pause?: () => void;
  seek?: (ms: number) => void;
}

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

// Reference stable : `useSyncEngine` liste `rows` dans ses dependances, donc un
// `[]` recree a chaque rendu demonterait la boucle rAF et reseterait `last`,
// ce qui re-declenche `onAyah` en boucle.
const NO_ROWS: readonly TimingRow[] = [];

export function PlayerBar(props: Props) {
  const { timings, audioUrl, reciters, reciter, onReciter, onAyah } = props;
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);

  useSyncEngine(audioEl, timings?.ayat ?? NO_ROWS, onAyah);

  // Changer de sourate doit remettre le curseur a zero, sinon on affiche la
  // position d'un audio precedent sur le nouvel audio.
  useEffect(() => {
    setPosition(0);
    setPlaying(false);
  }, [audioUrl]);

  useEffect(() => {
    const el = audioEl;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime * 1000);
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [audioEl]);

  const doPlay = async () => {
    if (props.play) await props.play();
    else if (audioEl) await audioEl.play();
    setPlaying(true);
  };
  const doPause = () => {
    if (props.pause) props.pause();
    else audioEl?.pause();
    setPlaying(false);
  };
  // Le range expose des SECONDES (step=1) ; `seek` recoit des MILLISECONDES.
  const doSeek = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    if (props.seek) props.seek(ms);
    else if (audioEl) audioEl.currentTime = seconds;
    setPosition(ms);
  };

  return (
    <div className="player">
      {/* `ref` en callback : c'est la seule facon d'obtenir un element audio
          stable, un `useRef` n'est pas reactive au premier rendu. */}
      <audio ref={setAudioEl} src={audioUrl} preload="metadata" data-testid="player-audio" />
      {reciters.length > 1 && (
        <select aria-label="Récitant" value={reciter} onChange={(e) => onReciter(Number(e.currentTarget.value))}>
          {reciters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.labelFr}
            </option>
          ))}
        </select>
      )}
      <button type="button" onClick={playing ? doPause : doPlay} aria-label={playing ? "Pause" : "Lire"}>
        {playing ? "❚❚" : "▶"}
      </button>
      <input
        data-testid="player-seek"
        type="range"
        min={0}
        max={(timings?.durationMs ?? 0) / 1000}
        step={1}
        value={Math.floor(position / 1000)}
        onChange={(e) => doSeek(Number(e.currentTarget.value))}
        aria-label="Position"
      />
      <span data-testid="player-position">{mmss(position)}</span>
      <span aria-hidden="true">/</span>
      <span data-testid="player-duration">{mmss(timings?.durationMs ?? 0)}</span>
      {timings && timings.precision !== "exact" && (
        <span className="badge">timings estimés</span>
      )}
    </div>
  );
}
