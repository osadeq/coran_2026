import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AMIRI_QURAN } from "../../scripts/lib/manifest.mjs";

// Plan 3, T8 — la permanence d'une investigation d'une fois. Le spec a etabli
// que QCF2001 (KFGQPC Hafs) couvre 0 des 69 codepoints du corpus uthmani :
// ses glyphes vivent dans le codepage prive U+F777..U+F8A6, disjoint du
// Unicode standard U+0600..U+06FF d'api.quran.com. Amiri Quran couvre 69/69.
// Tant que ce test existe, un changement de police ne peut pas reintroduire
// des carres vides sans qu'un test le dise.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AMIRI = join(ROOT, "src", "assets", "fonts", "AmiriQuran-Regular.ttf");
const WARSH = join(ROOT, "src", "assets", "fonts", "kfgqpc_warsh_v30.ttf");

/** Caracteres ignorables : espaces et marqueurs de direction. */
const isIgnorable = (cp: number): boolean =>
  cp === 0x0020 || cp === 0x00a0 || cp === 0x061c || (cp >= 0x200b && cp <= 0x200f);

/** Tous les codepoints distincts du champ text des 6236 lignes Hafs. */
function corpusCodepoints(): Set<number> {
  const corpus = JSON.parse(
    readFileSync(join(ROOT, "src", "data", "quran-hafs.json"), "utf8"),
  ) as { surahs: { a: readonly (readonly [number, number, string])[] }[] };
  const set = new Set<number>();
  for (const surah of corpus.surahs) {
    for (const row of surah.a) {
      for (const ch of row[2]) {
        const cp = ch.codePointAt(0) ?? 0;
        if (!isIgnorable(cp)) set.add(cp);
      }
    }
  }
  return set;
}

/**
 * Codepoints pour lesquels la cmap du TTF produit un glyphe non nul.
 * Formats 4, 6 et 12 (12 par precaution : les polices Google l'utilisent).
 */
function cmapCodepoints(ttf: Buffer): Set<number> {
  const numTables = ttf.readUInt16BE(4);
  let cmapOffset = -1;
  for (let i = 0; i < numTables; i += 1) {
    const rec = 12 + i * 16;
    if (ttf.toString("ascii", rec, rec + 4) === "cmap") {
      cmapOffset = ttf.readUInt32BE(rec + 8);
      break;
    }
  }
  if (cmapOffset < 0) throw new Error("table cmap absente du TTF");

  const out = new Set<number>();
  const numSubtables = ttf.readUInt16BE(cmapOffset + 2);

  for (let s = 0; s < numSubtables; s += 1) {
    const rec = cmapOffset + 4 + s * 8;
    const sub = cmapOffset + ttf.readUInt32BE(rec + 4);
    const format = ttf.readUInt16BE(sub);

    if (format === 4) {
      const segCount = ttf.readUInt16BE(sub + 6) / 2;
      const endOff = sub + 14;
      const startOff = endOff + segCount * 2 + 2; // +2 : reservedPad
      const deltaOff = startOff + segCount * 2;
      const rangeOff = deltaOff + segCount * 2;
      for (let i = 0; i < segCount; i += 1) {
        const start = ttf.readUInt16BE(startOff + i * 2);
        const end = ttf.readUInt16BE(endOff + i * 2);
        if (start > end || end === 0xffff) continue;
        const delta = ttf.readInt16BE(deltaOff + i * 2);
        const idRangeOffset = ttf.readUInt16BE(rangeOff + i * 2);
        for (let cp = start; cp <= end; cp += 1) {
          let glyph: number;
          if (idRangeOffset === 0) {
            glyph = (cp + delta) & 0xffff;
          } else {
            // Adresse : position courante de idRangeOffset, plus le deplacement
            // specifique au segment, plus l'index du codepoint dans le segment.
            const addr = rangeOff + i * 2 + idRangeOffset + (cp - start) * 2;
            glyph = ttf.readUInt16BE(addr);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) out.add(cp);
        }
      }
    } else if (format === 6) {
      const first = ttf.readUInt16BE(sub + 6);
      const count = ttf.readUInt16BE(sub + 8);
      for (let k = 0; k < count; k += 1) {
        if (ttf.readUInt16BE(sub + 10 + k * 2) !== 0) out.add(first + k);
      }
    } else if (format === 12) {
      const numGroups = ttf.readUInt32BE(sub + 12);
      for (let g = 0; g < numGroups; g += 1) {
        const rec = sub + 20 + g * 12;
        const start = ttf.readUInt32BE(rec);
        const end = ttf.readUInt32BE(rec + 4);
        const startGlyph = ttf.readUInt32BE(rec + 8);
        for (let cp = start; cp <= end; cp += 1) {
          if (startGlyph + (cp - start) !== 0) out.add(cp);
        }
      }
    }
  }
  return out;
}

const hex = (cp: number): string =>
  `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

const corpus = corpusCodepoints();
const amiri = cmapCodepoints(readFileSync(AMIRI));
const warsh = cmapCodepoints(readFileSync(WARSH));

describe("couverture des glyphes du corpus Hafs", () => {
  // Le nombre 69 est une mesure, pas un pari : s'il change, c'est le corpus
  // qui a bouge et la couverture doit etre remesuree avant de l'ignorer.
  it("retient 69 codepoints distincts (mesure du corpus)", () => {
    expect(
      corpus.size,
      `mesure actuelle : ${corpus.size} codepoints distincts (attendu 69) — ` +
        "si cette valeur change, recharger le corpus et remesurer la couverture " +
        "des deux polices avant de corriger l'assertion",
    ).toBe(69);
  });

  // La raison d'etre d'Amiri Quran : rien de visible ne doit manquer.
  it("Amiri Quran couvre les 69 codepoints du corpus", () => {
    const missing = [...corpus].filter((cp) => !amiri.has(cp)).map(hex);
    expect(missing, `codepoints sans glyphe Amiri : ${missing.join(" ")}`).toEqual([]);
  });

  // Section 2.6 du spec : le 0/69 etait celui de QCF2001.ttf (non vendor), pas
  // de cette police. Mesure reelle de kfgqpc_warsh_v30.ttf sur le meme corpus :
  // 58/69 — les lettres arabes standard ont un glyphe reel (verifie par loca/glyf),
  // mais 11 marques quraniques manquent. Elle n'est donc pas un substitut
  // viable pour le texte Hafs : c'est ce qui justifie Amiri. Ecart a T9.
  // Si cet assert echoue un jour, la police Warsh a change : remesurer avant
  // de toucher a la liste.
  it("kfgqpc_warsh_v30 laisse 11 trous sur le corpus Hafs", () => {
    const missing = [...corpus]
      .filter((cp) => !warsh.has(cp))
      .map(hex)
      .sort();
    expect(
      missing,
      `trous mesures : ${missing.join(" ") || "aucun"} — ` +
        "si la liste change, la police Warsh vendor a change : remesurer la " +
        "couverture complete des deux polices avant de corriger l'assertion",
    ).toEqual([
      "U+0671",
      "U+06D9",
      "U+06DA",
      "U+06DB",
      "U+06DF",
      "U+06E3",
      "U+06E7",
      "U+06E8",
      "U+06EA",
      "U+06EB",
      "U+06ED",
    ]);
  });
});
