import { describe, expect, it } from "vitest";
import { AYAH_RECITERS, selectAyahReciter } from "../../scripts/lib/manifest.mjs";
import { ayahUrl, pad3 } from "../../src/audio/ayah-source";

// Source figee du plan 2 (T-A) : URL verified 2026-09-28 par HEAD sur
// https://everyayah.com/data/warsh/warsh_Abdul_Basit_128kbps/112001.mp3
// -> 200 audio/mpeg, Accept-Ranges: bytes, Access-Control-Allow-Origin: *.

import type { AyahReciter } from "../../src/types";

// `manifest.mjs` est en JS (checkJs false) : le typage de la table est retabli ici,
// c'est exactement ce que `meta.ayahReciters` consomme cote app.
const reciters = AYAH_RECITERS as readonly AyahReciter[];
const abdulBasit = reciters.find((r) => r.priority === 0)!;

describe("pad3", () => {
  it("pad avec des zeros de tete jusqu'a trois chiffres", () => {
    expect(pad3(1)).toBe("001");
    expect(pad3(9)).toBe("009");
    expect(pad3(255)).toBe("255");
  });

  it("refuse ce qui ne tient pas sur trois chiffres", () => {
    expect(() => pad3(0)).toThrow(RangeError);
    expect(() => pad3(1000)).toThrow(RangeError);
    expect(() => pad3(1.5)).toThrow(RangeError);
  });
});

describe("ayahUrl", () => {
  it("construit NNNMMM avec un padding 3+3", () => {
    expect(ayahUrl(abdulBasit, 112, 1, 4)).toBe(
      "https://everyayah.com/data/warsh/warsh_Abdul_Basit_128kbps/112001.mp3",
    );
    // Le padding 3+3 se verifie sur 2:255 (la plus longue sourate) : 002 + 255.
    expect(ayahUrl(abdulBasit, 2, 255, 286)).toMatch(/\/002255\.mp3$/);
    // Un verset a un chiffre doit etre paddee cote ayah aussi : 001001.
    expect(ayahUrl(abdulBasit, 1, 1, 7)).toMatch(/\/001001\.mp3$/);
  });

  it("utilise le repertoire du recitant passe", () => {
    const aldosary = reciters.find((r) => r.id === 2)!;
    expect(ayahUrl(aldosary, 112, 1, 4)).toContain("/warsh/warsh_ibrahim_aldosary_128kbps/");
  });

  it("refuse un verset hors bornes (0, au-dela du compte, non entier)", () => {
    expect(() => ayahUrl(abdulBasit, 112, 0, 4)).toThrow(RangeError);
    expect(() => ayahUrl(abdulBasit, 112, 5, 4)).toThrow(RangeError);
    expect(() => ayahUrl(abdulBasit, 112, 1.5, 4)).toThrow(RangeError);
  });

  it("refuse une sourate hors [1, 114]", () => {
    expect(() => ayahUrl(abdulBasit, 115, 1, 4)).toThrow(RangeError);
    expect(() => ayahUrl(abdulBasit, 0, 1, 4)).toThrow(RangeError);
  });
});

describe("AYAH_RECITERS (manifeste)", () => {
  it("declare exactement trois recitants Warsh, ids uniques, un seul defaut", () => {
    expect(AYAH_RECITERS).toHaveLength(3);
    const ids = new Set(AYAH_RECITERS.map((r) => r.id));
    expect(ids.size).toBe(3);
    const defaults = AYAH_RECITERS.filter((r) => r.priority === 0);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].dir).toBe("warsh_Abdul_Basit_128kbps");
  });

  it("selectAyahReciter valide contre le manifeste, comme selectReciter", () => {
    expect(selectAyahReciter("").id).toBe(1);
    expect(selectAyahReciter("2").dir).toBe("warsh_ibrahim_aldosary_128kbps");
    expect(() => selectAyahReciter("9")).toThrow(/inconnu/);
    expect(() => selectAyahReciter("abc")).toThrow(/non numerique/);
  });
});
