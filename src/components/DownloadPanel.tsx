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
    <div
      className="download-panel"
      style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}
    >
      <button
        data-testid="download-surah"
        disabled={downloading}
        onClick={handleDownloadSurah}
      >
        Télécharger sourate {surah.n}
      </button>

      <button
        data-testid="download-juz"
        disabled={downloading}
        onClick={handleDownloadJuz}
      >
        Télécharger juz {currentJuz}
      </button>

      {progress && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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

      {error && <span className="download-error" style={{ color: "red" }}>{error}</span>}
    </div>
  );
};
