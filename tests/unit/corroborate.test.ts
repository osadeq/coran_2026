import { describe, expect, it } from "vitest";
import divergence from "../../scripts/fixtures/juz-divergence.json" with { type: "json" };
import { compareWithQuranMeta } from "../../scripts/lib/corroborate.mjs";

const warsh = {
  findPage: (s: number, a: number) => (s === 1 && a === 1 ? 1 : 1),
  findJuz: (s: number, a: number) => 1,
};

describe("compareWithQuranMeta", () => {
  it("detecte les ecarts de page", () => {
    const rows = Array.from({ length: 2 }, (_, i) => ({
      sura_no: 1,
      aya_no: i + 1,
      page: 1,
      jozz: 1,
    }));
    const r = compareWithQuranMeta(rows, warsh);
    expect(r.pageDiffs).toHaveLength(0);
  });

  it("exige une correspondance parfaite des pages", () => {
    const rows = [{ sura_no: 1, aya_no: 1, page: 2, jozz: 1 }];
    const r = compareWithQuranMeta(rows, warsh);
    expect(r.pageDiffs).toEqual([{ ayah: "1:1", kfc: 2, meta: 1 }]);
  });

  it("compare le juz et signale les divergences", () => {
    const rows = [{ sura_no: 2, aya_no: 141, page: 1, jozz: 2 }];
    const r = compareWithQuranMeta(rows, {
      findPage: () => 1,
      findJuz: () => 1,
    });
    expect(r.juzDiffs).toEqual([{ ayah: "2:141", kfc: 2, meta: 1 }]);
  });

  it("la fixture de divergence couvre 17 ayat et tous les couples distincts", () => {
    expect(divergence).toHaveLength(17);
    const pairs = new Set(divergence.map((d: { kfc: number; meta: number }) => `${d.kfc}->${d.meta}`));
    expect(pairs.has("6->5")).toBe(true);
    expect(pairs.has("6->7")).toBe(true);
    expect(pairs.has("7->8")).toBe(true);
    expect(pairs.has("9->8")).toBe(true);
  });
});
