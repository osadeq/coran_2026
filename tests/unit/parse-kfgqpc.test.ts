import { describe, expect, it } from "vitest";
import { IngestError, parseKfgqpc } from "../../scripts/lib/parse-kfgqpc.mjs";
import surahCounts from "../../scripts/fixtures/surah-counts.json" with { type: "json" };

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  jozz: 1,
  page: 1,
  sura_no: 1,
  sura_name_en: "Al-Fatihah",
  sura_name_ar: "الفاتحة",
  line_start: 1,
  line_end: 1,
  aya_no: 1,
  aya_text_unicode: "بِسْمِ",
  ...over,
});

// jeu complet valide pilote par la fixture des comptes Warsh
const fullRows = () => {
  const counts = Object.values(surahCounts);
  const out: Record<string, unknown>[] = [];
  let id = 1;
  for (let n = 1; n <= 114; n += 1) {
    for (let a = 1; a <= counts[n - 1]; a += 1) {
      out.push(row({ id, sura_no: n, aya_no: a, page: 1, jozz: 1 }));
      id += 1;
    }
  }
  return out;
};

describe("parseKfgqpc", () => {
  it("refuse un tableau vide", () => {
    expect(() => parseKfgqpc([])).toThrow(IngestError);
  });

  it("refuse un compte d'ayat inattendu", () => {
    expect(() => parseKfgqpc([row()])).toThrow(/6214/);
  });

  it("refuse un id discontinu", () => {
    const rows = fullRows();
    rows[10] = { ...rows[10], id: 12 };
    expect(() => parseKfgqpc(rows)).toThrow(/discontinu/i);
  });

  it("refuse un champ manquant", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    delete (rows[0] as Record<string, unknown>).jozz;
    expect(() => parseKfgqpc(rows)).toThrow(/champ manquant/i);
  });

  it("refuse un champ inattendu", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    (rows[0] as Record<string, unknown>).aya_text_emlaey = "x";
    expect(() => parseKfgqpc(rows)).toThrow(/champ inattendu/i);
  });

  it("refuse une page hors bornes", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    rows[0] = row({ id: 1, page: 605 });
    expect(() => parseKfgqpc(rows)).toThrow(/page hors bornes/i);
  });

  it("refuse un codepoint etendu inconnu", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    rows[0] = row({ id: 1, aya_text_unicode: "خ\u0890" });
    expect(() => parseKfgqpc(rows)).toThrow(/U\+0890/);
  });

  it("refuse un champ numerique non entier", () => {
    const rows = fullRows();
    rows[0] = row({ id: 1, page: "2" });
    expect(() => parseKfgqpc(rows)).toThrow(/entier/);
  });

  it("accepte un jeu complet valide et rend 114 sourates", () => {
    const out = parseKfgqpc(fullRows());
    expect(out.meta.ayahCount).toBe(6214);
    expect(out.meta.surahCount).toBe(114);
    expect(out.surahs[0].n).toBe(1);
    expect(out.surahs[0].a).toHaveLength(7);
    expect(out.surahs[1].a).toHaveLength(285);
    expect(out.surahs.at(-1)!.n).toBe(114);
    expect(out.surahs.at(-1)!.a).toHaveLength(6);
  });

  it("applique stripAyahEndMarker au texte de chaque ayah", () => {
    const rows = fullRows();
    rows[0] = row({ id: 1, sura_no: 1, aya_no: 1, aya_text_unicode: "بِسْمِ\u00A0\u06DD\u0661" });
    const out = parseKfgqpc(rows);
    expect(out.surahs[0].a[0][2]).toBe("بِسْمِ");
  });

  it("respecte les comptes de sourate figes", () => {
    expect(surahCounts["1"]).toBe(7);
    expect(surahCounts["2"]).toBe(285);
    expect(surahCounts["3"]).toBe(200);
    expect(surahCounts["110"]).toBe(3);
    expect(surahCounts["112"]).toBe(4);
    expect(surahCounts["114"]).toBe(6);
    expect(Object.keys(surahCounts)).toHaveLength(114);
    expect(Object.values(surahCounts).reduce((a, b) => a + b, 0)).toBe(6214);
  });
});
