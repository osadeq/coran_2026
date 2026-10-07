// Riwaya de lecture : le corpus, les recitants et la police du texte dependent
// de ce choix (plan 3, taches 2 a 8).
export type Riwaya = "warsh" | "hafs";

export type AyahRow = readonly [juz: number, page: number, text: string];

export interface Surah {
  n: number;
  en: string;
  ar: string;
  a: AyahRow[];
}

export interface QuranData {
  meta: {
    riwaya: Riwaya;
    source: string;
    ayahCount: number;
    surahCount: number;
    pageCount: number;
    juzCount: number;
  };
  surahs: Surah[];
}

export type Precision = "exact" | "partial" | "estimated";

export type TimingRow = readonly [ayah: number, startMs: number, endMs: number];

export interface AyahGeometry {
  polygon: string | null;
  page: string | null;
  // 26 ayat sur 6214 n'ont ni polygon ni page, donc pas de coordonnees non plus : les
  // quatre champs tombent a `null` ensemble. Les declarer `string` promettrait un `string`
  // la ou le corpus commite contient `null`.
  x: string | null;
  y: string | null;
}

export interface SurahTimings {
  surah: number;
  reciter: number;
  audioUrl: string;
  precision: Precision;
  durationMs: number;
  ayat: TimingRow[];
  // Ecrit par scripts/ingest.mjs dans chaque src/data/timings/<id>.json, et consomme par
  // la Tache 11 via import.meta.glob : sans ce champ, ces donnees violeraient leur type.
  geometry: Record<string, AyahGeometry>;
}

export interface Reciter {
  id: number;
  rewayaId: number;
  label: string;
  labelFr: string;
  priority: number;
}

// Plan 3 (T2) — recitant du mode « un fichier mp3 par verset » (everyayah).
// Table unique des deux modes : `scripts/lib/manifest.mjs::AYAH_RECITERS`,
// ids globaux 1..8 (Warsh = 1, Hafs = 2..8), le champ `riwaya` les distingue.
// `id` est local, pas un moshaf mp3quran. `meta.json.ayahReciters` ne porte que
// l'historique Warsh, sans `riwaya` : ce n'est plus une source de recitants
// (tache 7 arrete App.tsx de le lire).
export interface AyahReciter {
  id: number;
  dir: string;
  bitrate: number;
  label: string;
  labelFr: string;
  priority: number;
  riwaya: Riwaya;
}
