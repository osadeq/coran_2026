import { useState } from "react";
import type { Surah } from "../types";
import { AyahItem } from "./AyahItem";

interface Props {
  surah: Surah;
  activeAyah: number | null;
  onSelect: (ayah: number) => void;
}

export function AyahList({ surah, activeAyah, onSelect }: Props) {
  const [follow, setFollow] = useState(true);

  return (
    <div className="ayah-list-container">
      <div className="ayah-list-toolbar" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
        <button
          data-testid="follow-toggle"
          type="button"
          aria-pressed={follow}
          onClick={() => setFollow((prev) => !prev)}
        >
          {follow ? "Suivi activé" : "Suivi désactivé"}
        </button>
      </div>
      <ol className="ayah-list" aria-label={`Sourate ${surah.en}`}>
        {surah.a.map(([juz, page, text], i) => (
          <AyahItem
            key={surah.n + ":" + (i + 1)}
            ayah={i + 1}
            text={text}
            juz={juz}
            page={page}
            active={activeAyah === i + 1}
            follow={follow}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </div>
  );
}
