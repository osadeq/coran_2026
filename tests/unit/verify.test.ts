import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KFGQPC, selectReciter } from "../../scripts/lib/manifest.mjs";
import { md5Hex, sha256File, sha256Hex } from "../../scripts/lib/verify.mjs";

describe("empreintes", () => {
  it("sha256Hex connait la valeur de reference", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("md5Hex connait la valeur de reference", () => {
    expect(md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("sha256File lit un vrai fichier, pas seulement une chaine", async () => {
    const dir = await mkdtemp(join(tmpdir(), "verify-"));
    const file = join(dir, "sample.bin");
    writeFileSync(file, "abc");
    await expect(sha256File(file)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("le manifeste fige les invariants du paquet officiel", () => {
    expect(KFGQPC.expected).toEqual({
      ayahCount: 6214,
      surahCount: 114,
      pageCount: 604,
      juzCount: 30,
    });
    expect(KFGQPC.zipSha256).toHaveLength(64);
    expect(KFGQPC.json.md5).toMatch(/^[0-9a-f]{32}$/);
    expect(KFGQPC.ttf.md5).toMatch(/^[0-9a-f]{32}$/);
  });

  it("declare l'absence de licence au lieu de l'inventer", () => {
    expect(KFGQPC.license).toBeNull();
    expect(KFGQPC.licenseNote).toMatch(/Aucune licence explicite publiee/);
  });
});

describe("selectReciter", () => {
  it("retourne le moshaf Warsh par defaut", () => {
    expect(selectReciter(undefined).id).toBe(120);
  });

  it("retourne le moshaf explicitement demande", () => {
    expect(selectReciter("120").id).toBe(120);
  });

  it("ne propose jamais le moshaf Hafs 118", () => {
    expect(() => selectReciter("118")).toThrow(/inconnu/);
  });

  it("refuse un identifiant non numerique", () => {
    expect(() => selectReciter("warsh")).toThrow(/numerique/);
  });

  it("refuse un reciter absent du manifeste", () => {
    expect(() => selectReciter("999")).toThrow(/inconnu/);
  });
});
