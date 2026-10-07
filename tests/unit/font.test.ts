import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AMIRI_QURAN, KFGQPC } from "../../scripts/lib/manifest.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONT = join(ROOT, "src", "assets", "fonts", "kfgqpc_warsh_v30.ttf");
// Plan 3, T8 : la police du texte Hafs, vendored du depot google/fonts.
const AMIRI = join(ROOT, "src", "assets", "fonts", "AmiriQuran-Regular.ttf");

describe("police KFGQPC", () => {
  it("est presente avec la bonne empreinte", () => {
    const buf = readFileSync(FONT);
    expect(createHash("md5").update(buf).digest("hex")).toBe(KFGQPC.ttf.md5);
  });

  it("a un en-tete TrueType valide", () => {
    const buf = readFileSync(FONT);
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x01, 0x00, 0x00]));
    expect(buf.length).toBeGreaterThan(200000);
  });
});

describe("police Amiri Quran", () => {
  // 136 920 octets (~137 Ko) : la taille exacte est pinnee par l'empreinte,
  // inutile de la retester ici. La licence, elle, n'est pas nulle — contrairement
  // a KFGQPC, dont l'absence de licence explicite est un fait documente.
  it("est presente avec la bonne empreinte", () => {
    const buf = readFileSync(AMIRI);
    expect(createHash("md5").update(buf).digest("hex")).toBe(AMIRI_QURAN.md5);
    expect(AMIRI_QURAN.license).toBeTruthy();
  });

  it("a un en-tete TrueType valide", () => {
    const buf = readFileSync(AMIRI);
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x01, 0x00, 0x00]));
  });
});
