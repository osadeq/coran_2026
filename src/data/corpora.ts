// Plan 3 (T3) — resolution riwaya -> corpus. Les deux JSON ont la meme forme,
// donc le meme cast que celui utilise dans App.tsx (`quran as unknown as QuranData`).
// `meta.riwaya` du fichier est la source de verite : RIWAYAS ne fait que
// enumerer les modes pour peupler le selecteur sans dupliquer la liste.
import type { QuranData, Riwaya } from "../types";
import hafs from "./quran-hafs.json";
import warsh from "./quran-warsh.json";

const CORPORA: Record<Riwaya, QuranData> = {
  warsh: warsh as unknown as QuranData,
  hafs: hafs as unknown as QuranData,
};

export function corpusOf(riwaya: Riwaya): QuranData {
  return CORPORA[riwaya];
}

export const RIWAYAS: readonly Riwaya[] = ["warsh", "hafs"];
