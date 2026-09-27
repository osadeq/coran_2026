import { describe, expect, it } from "vitest";
import { findAyahAt } from "../../src/sync/timing-index";

const rows = [
  [1, 0, 1000],
  [2, 1000, 2500],
  [3, 2500, 4000],
] as const;

describe("findAyahAt", () => {
  it("renvoie null avant le premier ayah", () => {
    expect(findAyahAt(rows, -1)).toBeNull();
  });

  it("trouve l'ayah au debut exact", () => {
    expect(findAyahAt(rows, 0)).toBe(1);
    expect(findAyahAt(rows, 1000)).toBe(2);
  });

  it("trouve l'ayah juste avant la fin", () => {
    expect(findAyahAt(rows, 999)).toBe(1);
    expect(findAyahAt(rows, 3999)).toBe(3);
  });

  it("reste sur le dernier ayah apres la fin", () => {
    expect(findAyahAt(rows, 99999)).toBe(3);
  });

  it("tient dans un trou sans perdre l'ayah courant", () => {
    const gapped = [
      [1, 0, 1000],
      [2, 1200, 2000],
    ] as const;
    expect(findAyahAt(gapped, 1100)).toBe(1);
  });

  it("renvoie null sur une liste vide", () => {
    expect(findAyahAt([], 0)).toBeNull();
  });

  it("est correct sur 6214 entrees synthetiques", () => {
    const big = Array.from({ length: 6214 }, (_, i) => [i + 1, i * 1000, i * 1000 + 1000] as const);
    for (let i = 0; i < 6214; i += 1) {
      expect(findAyahAt(big, i * 1000 + 500)).toBe(i + 1);
    }
  });
});
