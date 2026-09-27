import { describe, expect, it } from "vitest";
import {
  EXTENDED_RANGE,
  KNOWN_KFGQPC_CODEPOINTS,
  findUnknownExtendedCodepoints,
  stripAyahEndMarker,
} from "../../scripts/lib/text.mjs";

describe("codepoints etendus KFGQPC", () => {
  it("fige les 14 codepoints observes", () => {
    expect(KNOWN_KFGQPC_CODEPOINTS).toHaveLength(14);
    expect(KNOWN_KFGQPC_CODEPOINTS[0]).toBe(0x870);
    expect(KNOWN_KFGQPC_CODEPOINTS.at(-1)).toBe(0x8f2);
  });

  it("accepte un texte utilisant les 14 codepoints", () => {
    const text = KNOWN_KFGQPC_CODEPOINTS.map((c) => String.fromCodePoint(c)).join("");
    expect(findUnknownExtendedCodepoints(text)).toEqual([]);
  });

  it("refuse un codepoint etendu hors liste", () => {
    expect(findUnknownExtendedCodepoints("a\u0890b")).toEqual(["U+0890"]);
  });

  it("ignore ce qui est hors de la plage etendue", () => {
    expect(findUnknownExtendedCodepoints("\u0628\u064E\u06DD")).toEqual([]);
    expect(EXTENDED_RANGE).toEqual({ start: 0x870, end: 0x8ff });
  });

  it("retire le marqueur de fin d'ayah suivi de ses chiffres", () => {
    // forme reelle observee : NBSP + U+06DD + numero en chiffres arabes-indiques
    expect(stripAyahEndMarker("بِسْمِ\u00A0\u06DD\u0661")).toBe("بِسْمِ");
    expect(stripAyahEndMarker("ن\u06DD\u0661\u0660\u0668")).toBe("ن");
  });

  it("ne touche ni un marqueur isole ni des chiffres isoles", () => {
    // garde-fou : ne pas convertir en ASCII un chiffre qui ferait partie du texte
    expect(stripAyahEndMarker("ن\u06DD")).toBe("ن\u06DD");
    expect(stripAyahEndMarker("\u0661\u0662")).toBe("\u0661\u0662");
  });
});
