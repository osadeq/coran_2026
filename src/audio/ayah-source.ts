// Plan 2, T-A / Plan 3, T5 — construction de l'URL d'un verset (un fichier mp3
// par verset).
//
// La source est figee dans `scripts/lib/manifest.mjs` (AYAH_RECITERS, bases
// everyayah, verifies par HEAD le 2026-09-28). Le prefixe de dossier depend de
// la riwaya du recitant : Warsh sous `/data/warsh/`, Hafs sous `/data/` — le
// format du nom de fichier, lui, est identique des deux cotes. NNNMMM :
// padding 3+3, 2:255 -> 002255, 112:1 -> 112001.
import { everyayahBase } from "../../scripts/lib/manifest.mjs";
import type { AyahReciter } from "../types";

function checkInt(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} doit etre entier: ${value}`);
  }
}

/** Repr sentinel `value` sur trois chiffres ; refuse 0 et > 999 (le schema NNNMMM l'exige). */
export function pad3(value: number): string {
  checkInt(value, "pad3");
  if (value < 1 || value > 999) {
    throw new RangeError(`pad3 attend 1..999, recu ${value}`);
  }
  return String(value).padStart(3, "0");
}

/**
 * URL complète du mp3 d'un verset. `ayahCount` est le nombre d'ayat de la sourate
 * (tiré de `quran-warsh.json`, `s.a.length`) : il sert a refuser un index hors du
 * corpus plutot que de produire une URL 404 en aval.
 */
export function ayahUrl(
  reciter: AyahReciter,
  surah: number,
  ayah: number,
  ayahCount: number,
): string {
  checkInt(surah, "surah");
  checkInt(ayah, "ayah");
  checkInt(ayahCount, "ayahCount");
  if (surah < 1 || surah > 114) {
    throw new RangeError(`surah hors [1, 114]: ${surah}`);
  }
  if (ayah < 1 || ayah > ayahCount) {
    throw new RangeError(`ayah hors [1, ${ayahCount}] pour la sourate ${surah}: ${ayah}`);
  }
  return `${everyayahBase(reciter.riwaya)}/${reciter.dir}/${pad3(surah)}${pad3(ayah)}.mp3`;
}
