import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");

const readJson = (relative: string) => {
  const path = resolve(root, relative);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as unknown;
};

const corpusPath = resolve(root, "src/data/quran-hafs.json");
const countsPath = resolve(root, "scripts/fixtures/hafs-surah-counts.json");

describe("corpus Hafs", () => {
  it("le corpus Hafs respecte les assertions requises", () => {
    const corpus = readJson("src/data/quran-hafs.json") as any;
    const counts = readJson("scripts/fixtures/hafs-surah-counts.json") as Record<string, number>;

    // corpus.surahs a 114 entrees, numerotees 1..114 dans l'ordre
    expect(corpus.surahs).toHaveLength(114);
    for (let i = 0; i < 114; i += 1) {
      expect(corpus.surahs[i].n).toBe(i + 1);
    }

    // meta.riwaya === "hafs" et meta.ayahCount === 6236
    expect(corpus.meta.riwaya).toBe("hafs");
    expect(corpus.meta.ayahCount).toBe(6236);

    // meta.ayahCount egale la somme des longueurs de chaque surahs[i].a
    let sumAyah = 0;
    for (let i = 0; i < 114; i += 1) {
      sumAyah += corpus.surahs[i].a.length;
    }
    expect(corpus.meta.ayahCount).toBe(sumAyah);

    // pour chaque sourate, surahs[i].a.length === Number(counts[String(surahs[i].n)])
    for (let i = 0; i < 114; i += 1) {
      const n = corpus.surahs[i].n;
      const count = counts[String(n)];
      expect(corpus.surahs[i].a.length).toBe(Number(count));
    }

    // sourate 2 a 286 versets
    expect(corpus.surahs[1].a.length).toBe(286);

    // chaque a[i] est un tableau de longueur 3 [juz, page, text], text non vide, juz dans 1..30, page dans 1..604
    for (let s = 0; s < 114; s += 1) {
      const ayas = corpus.surahs[s].a;
      for (let i = 0; i < ayas.length; i += 1) {
        const ay = ayas[i];
        expect(Array.isArray(ay)).toBe(true);
        expect(ay).toHaveLength(3);
        expect(typeof ay[2]).toBe("string");
        expect(ay[2].length).toBeGreaterThan(0);
        expect(ay[0]).toBeGreaterThanOrEqual(1);
        expect(ay[0]).toBeLessThanOrEqual(30);
        expect(ay[1]).toBeGreaterThanOrEqual(1);
        expect(ay[1]).toBeLessThanOrEqual(604);
      }
    }

    // meta.juzCount === 30 et meta.pageCount === 604
    expect(corpus.meta.juzCount).toBe(30);
    expect(corpus.meta.pageCount).toBe(604);
  });
});
