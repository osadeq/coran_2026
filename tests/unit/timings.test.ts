import { describe, expect, it } from "vitest";
import {
  PRECISION,
  classifyTimings,
  contiguousPrefix,
  isMonotonic,
  normalizeTimings,
} from "../../scripts/lib/timings.mjs";

const PAGE = "https://www.mp3quran.net/api/quran_pages_svg/002.svg";

const row = (
  ayah: number,
  startTime: number,
  endTime: number,
  geometry: { polygon?: string | null; page?: string | null } = {},
) => ({
  ayah,
  startTime,
  endTime,
  polygon: geometry.polygon === undefined ? "10,10 20,10 20,20" : geometry.polygon,
  page: geometry.page === undefined ? PAGE : geometry.page,
  x: "15",
  y: "15",
});

describe("normalizeTimings", () => {
  it("convertit start_time/end_time et garde le reste", () => {
    const out = normalizeTimings([
      {
        ayah: 1,
        polygon: "1,2 3,4",
        start_time: 6054,
        end_time: 15993,
        x: "178.34",
        y: "63.11",
        page: PAGE,
      },
    ]);
    expect(out).toEqual([
      { ayah: 1, startTime: 6054, endTime: 15993, polygon: "1,2 3,4", page: PAGE, x: "178.34", y: "63.11" },
    ]);
  });

  it("normalise une geometrie absente en null, pas en chaine vide", () => {
    const out = normalizeTimings([
      { ayah: 5, polygon: null, start_time: 0, end_time: 10, x: "", y: "", page: null },
    ]);
    expect(out[0].polygon).toBeNull();
    expect(out[0].page).toBeNull();
  });

  it("refuse une charge utile qui n'est pas un tableau", () => {
    expect(() => normalizeTimings({ surah: 1, ayahs: [] })).toThrow(TypeError);
  });

  it("refuse un temps non fini", () => {
    expect(() =>
      normalizeTimings([{ ayah: 1, polygon: null, start_time: null, end_time: 10, x: "", y: "", page: null }]),
    ).toThrow(TypeError);
  });
});

describe("classifyTimings", () => {
  it("exact quand les ayat couvrent exactement la sourate", () => {
    const ayahs = [row(1, 0, 900), row(2, 900, 3000), row(3, 3000, 5000)];
    const r = classifyTimings({ ayahs, canonicalCount: 3 });
    expect(r.precision).toBe(PRECISION.EXACT);
    expect(r.missingTail).toBe(0);
    expect(r.coveredMax).toBe(3);
  });

  it("rejette une basmala synthetique : signature d'un moshaf Hafs", () => {
    expect(() =>
      classifyTimings({ ayahs: [row(0, 0, 900), row(1, 900, 3000)], canonicalCount: 1 }),
    ).toThrow(/ayah:0/);
  });

  it("compte les ayat sans geometrie sans les considerer manquants", () => {
    const ayahs = [
      row(1, 0, 1000),
      row(2, 1000, 2000, { polygon: null, page: null }),
      row(3, 2000, 3000),
    ];
    const r = classifyTimings({ ayahs, canonicalCount: 3 });
    expect(r.precision).toBe(PRECISION.EXACT);
    expect(r.missingGeometry).toEqual([2]);
  });

  it("partial quand la queue manque", () => {
    const ayahs = [row(1, 0, 1000), row(2, 1000, 2000)];
    const r = classifyTimings({ ayahs, canonicalCount: 7 });
    expect(r.precision).toBe(PRECISION.PARTIAL);
    expect(r.coveredMax).toBe(2);
    expect(r.missingTail).toBe(5);
  });

  it("estimated quand la numerotation deborde la sourate", () => {
    const ayahs = Array.from({ length: 10 }, (_, i) => row(i + 1, i * 100, i * 100 + 100));
    const r = classifyTimings({ ayahs, canonicalCount: 6 });
    expect(r.precision).toBe(PRECISION.ESTIMATED);
    expect(r.missingTail).toBe(0);
  });

  it("plafonne coveredMax au compte canonique", () => {
    const ayahs = Array.from({ length: 10 }, (_, i) => row(i + 1, i * 100, i * 100 + 100));
    expect(classifyTimings({ ayahs, canonicalCount: 6 }).coveredMax).toBe(6);
  });

  it("partial sur un trou interne", () => {
    const ayahs = [row(1, 0, 1000), row(3, 1000, 2000)];
    const r = classifyTimings({ ayahs, canonicalCount: 3 });
    expect(r.precision).toBe(PRECISION.PARTIAL);
    expect(r.contiguous).toBe(false);
  });

  it("estimated sur une sourate sans donnee", () => {
    const r = classifyTimings({ ayahs: [], canonicalCount: 5 });
    expect(r.precision).toBe(PRECISION.ESTIMATED);
    expect(r.coveredMax).toBe(0);
  });

  it("rejette une entree invalide", () => {
    expect(() => classifyTimings({ ayahs: null, canonicalCount: 3 })).toThrow();
  });
});

describe("isMonotonic", () => {
  it("accepte une sequence croissante non chevauchante", () => {
    expect(isMonotonic([row(1, 0, 100), row(2, 100, 200)])).toBe(true);
  });

  it("refuse un chevauchement", () => {
    expect(isMonotonic([row(1, 0, 150), row(2, 100, 200)])).toBe(false);
  });

  it("refuse un recul", () => {
    expect(isMonotonic([row(1, 200, 300), row(2, 100, 200)])).toBe(false);
  });

  it("refuse un intervalle vide ou negatif", () => {
    expect(isMonotonic([row(1, 0, 0)])).toBe(false);
    expect(isMonotonic([row(1, -10, 100)])).toBe(false);
  });
});

describe("contiguousPrefix", () => {
  it("compte le prefixe 1..n", () => {
    expect(contiguousPrefix([1, 2, 3, 4])).toBe(4);
  });

  it("s'arrete au premier trou", () => {
    expect(contiguousPrefix([1, 2, 4, 5])).toBe(2);
    expect(contiguousPrefix([2, 3])).toBe(0);
  });

  it("tolere un surplus etranger apres le prefixe", () => {
    expect(contiguousPrefix([1, 2, 3, 47, 48])).toBe(3);
  });
});
