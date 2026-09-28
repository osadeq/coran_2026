import type { Surah } from "../types";
import { AyahItem } from "./AyahItem";

interface Props {
  surah: Surah;
  activeAyah: number | null;
  onSelect: (ayah: number) => void;
}

export function AyahList({ surah, activeAyah, onSelect }: Props) {
  return (
    <ol className="ayah-list" aria-label={`Sourate ${surah.en}`}>
      {surah.a.map(([juz, page, text], i) => (
        <AyahItem
          key={surah.n + ":" + (i + 1)}
          ayah={i + 1}
          text={text}
          juz={juz}
          page={page}
          active={activeAyah === i + 1}
          onSelect={onSelect}
        />
      ))}
    </ol>
  );
}
