import { describe, expect, it } from "vitest";
import { estimateTail } from "../../scripts/lib/estimate.mjs";

const wordsOf = (map: Record<number, number>) => (ayah: number) => map[ayah] ?? 1;

describe("estimateTail", () => {
  it("remplit la queue manquante", () => {
    const rows = estimateTail({
      durationMs: 3000,
      coveredMax: 2,
      canonicalCount: 4,
      wordsOf: wordsOf({ 3: 1, 4: 1 }),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe(3);
    expect(rows[1][0]).toBe(4);
  });

  it("termine exactement sur la duree", () => {
    const rows = estimateTail({
      durationMs: 3000,
      coveredMax: 1,
      canonicalCount: 4,
      wordsOf: wordsOf({ 2: 1, 3: 2, 4: 5 }),
    });
    expect(rows.at(-1)![2]).toBe(3000);
  });

  it("reste strictement croissant et sans trou", () => {
    const rows = estimateTail({
      durationMs: 10000,
      coveredMax: 0,
      canonicalCount: 7,
      wordsOf: wordsOf({ 1: 3, 2: 1, 3: 9, 4: 2, 5: 4, 6: 1, 7: 6 }),
    });
    expect(rows[0][1]).toBe(0);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i][1]).toBe(rows[i - 1][2]);
      expect(rows[i][2]).toBeGreaterThan(rows[i][1]);
    }
  });

  it("renvoie un tableau vide si rien a estimer", () => {
    expect(
      estimateTail({ durationMs: 100, coveredMax: 4, canonicalCount: 4, wordsOf: () => 1 }),
    ).toEqual([]);
  });

  it("ne produit jamais d'intervalle vide avec un poids dominant", () => {
    const rows = estimateTail({
      durationMs: 10,
      coveredMax: 0,
      canonicalCount: 3,
      wordsOf: wordsOf({ 1: 1, 2: 1_000_000, 3: 1 }),
    });
    for (const [, start, end] of rows) expect(end).toBeGreaterThan(start);
    expect(rows.at(-1)![2]).toBe(10);
  });
});
