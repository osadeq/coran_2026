import React, { useState } from "react";
import type { AyahReciter, QuranData, Surah } from "../types";
import { downloadUnit, type DownloadProgress } from "../audio/audio-store";

export interface DownloadPanelProps {
  surah: Surah;
  ayahIndex: number;
  reciter: AyahReciter;
  quran: QuranData;
}

export const DownloadPanel: React.FC<DownloadPanelProps> = ({
  surah,
  ayahIndex,
  reciter,
  quran,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentJuz = surah.a[ayahIndex]?.[0] ?? surah.a[0]?.[0] ?? 1;

  const handleDownloadSurah = async () => {
    setDownloading(true);
    setError(null);
    setProgress({ done: 0, total: surah.a.length });
    try {
      await downloadUnit({ kind: "surah", n: surah.n }, reciter, quran, {
        onProgress: (p) => setProgress(p),
      });
    } catch {
      setError("Échec du téléchargement");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadJuz = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadUnit({ kind: "juz", j: currentJuz }, reciter, quran, {
        onProgress: (p) => setProgress(p),
      });
    } catch {
      setError("Échec du téléchargement");
    } finally {
      setDownloading(false);
    }
  };

  const estimatedMb = progress ? ((progress.total * 402) / 1024).toFixed(1) : "0";

  return (
    <div className="download-panel">
      <button
        data-testid="download-surah"
        disabled={downloading}
        onClick={handleDownloadSurah}
        aria-label={`Télécharger toute la sourate ${surah.n}`}
        title={`Télécharger toute la sourate ${surah.n} pour écoute hors ligne`}
      >
        Télécharger sourate {surah.n}
      </button>

      <button
        data-testid="download-juz"
        disabled={downloading}
        onClick={handleDownloadJuz}
        aria-label={`Télécharger le juz ${currentJuz}`}
        title={`Télécharger le juz ${currentJuz} pour écoute hors ligne`}
      >
        Télécharger juz {currentJuz}
      </button>

      {progress && (
        <div className="download-progress">
          <progress
            data-testid="download-progress"
            value={progress.done}
            max={progress.total}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          />
          <span>
            {progress.done}/{progress.total} · ≈{estimatedMb} Mo
          </span>
        </div>
      )}

      {error && <span className="download-error">{error}</span>}
    </div>
  );
};
