export type AyahRow = readonly [juz: number, page: number, text: string];

export interface Surah {
  n: number;
  en: string;
  ar: string;
  a: AyahRow[];
}

export interface QuranData {
  meta: {
    riwaya: "warsh";
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
