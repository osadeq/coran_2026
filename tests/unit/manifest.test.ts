// Manifest Hafs par riwaya
import { AYAH_RECITERS, rewayaReciters, defaultAyahReciter, everyayahBase, selectAyahReciter, EVERYAYAH_BASE } from "../../scripts/lib/manifest.mjs";
import { it, describe, expect } from "vitest";
import { readFileSync } from "node:fs";

// Get root: vitest provides import.meta.dirname in node mode
const testDir = import.meta.dirname || "../..";
const root = testDir.replace(/\/[^/]*$/, "") + "/.." + "/..";

function readJson(relative: string) {
  const path = root + "/" + relative;
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as unknown;
}

describe("manifest riwaya", () => {
  // 1. rewayaReciters
  it("rewayaReciters(\"warsh\") a 1 element, rewayaReciters(\"hafs\") a 7", () => {
    expect(rewayaReciters("warsh").length).toBe(1);
    expect(rewayaReciters("hafs").length).toBe(7);
  });

  // 2. defaultAyahReciter
  it("defaultAyahReciter(\"warsh\").id === 1, defaultAyahReciter(\"hafs\").id === 2", () => {
    expect(defaultAyahReciter("warsh").id).toBe(1);
    expect(defaultAyahReciter("hafs").id).toBe(2);
  });

  // 3. defaultAyahReciter est membre de rewayaReciters
  it("defaultAyahReciter(riwaya) est membre de rewayaReciters(riwaya)", () => {
    expect(rewayaReciters("warsh").some((r) => r.id === defaultAyahReciter("warsh").id)).toBe(true);
    expect(rewayaReciters("hafs").some((r) => r.id === defaultAyahReciter("hafs").id)).toBe(true);
  });

  // 4. ids disjoints, union size 8
  it("les ids des deux modes sont disjoints (union size 8)", () => {
    const ids = new Set();
    rewayaReciters("warsh").forEach((r) => ids.add(r.id));
    rewayaReciters("hafs").forEach((r) => ids.add(r.id));
    expect(ids.size).toBe(8);
  });

  // 5. chaque recitant a r.riwaya === r
  it("chaque recitant a r.riwaya === r", () => {
    rewayaReciters("warsh").forEach((r) => expect(r.riwaya).toBe("warsh"));
    rewayaReciters("hafs").forEach((r) => expect(r.riwaya).toBe("hafs"));
  });

  // 6. les 7 dossiers Hafs
  it("les 7 dossiers Hafs dans l'ordre attendu", () => {
    const hafsDirs = rewayaReciters("hafs").map((r) => r.dir);
    expect(hafsDirs).toEqual([
      "Husary_128kbps",
      "Yasser_Ad-Dussary_128kbps",
      "Minshawy_Murattal_128kbps",
      "Mohammad_al_Tablaway_128kbps",
      "Abdurrahmaan_As-Sudais_192kbps",
      "Hani_Rifai_192kbps",
      "Abdul_Basit_Murattal_192kbps",
    ]);
  });

  // 7. pas de prefxe warsh_, seul Warsh est warsh_Abdul_Basit_128kbps
  it("aucun dossier Hafs ne commence par warsh_", () => {
    rewayaReciters("hafs").forEach((r) => {
      expect(r.dir).not.toMatch(/^warsh_/);
    });
    expect(rewayaReciters("warsh")[0].dir).toBe("warsh_Abdul_Basit_128kbps");
  });

  // 8. everyayahBase
  it("everyayahBase corrects selon le mode", () => {
    expect(everyayahBase("warsh")).toBe("https://everyayah.com/data/warsh");
    expect(everyayahBase("hafs")).toBe("https://everyayah.com/data");
  });

  // 9. selectAyahReciter globale non ambiguë
  it("selectAyahReciter(\"2\") renvoie le recitant Hafs id 2", () => {
    expect(selectAyahReciter("2").dir).toBe("Husary_128kbps");
    expect(selectAyahReciter("2").riwaya).toBe("hafs");
  });

  // 10. anti-drift : intersection meta.json vs manifeste
  it("anti-drift : intersection meta.json/manifest sur ids warsh", () => {
    const meta = readJson("src/data/meta.json") as any;
    const warshIds = new Set(rewayaReciters("warsh").map((r) => r.id));
    // Pour chaque entry de meta.ayahReciters dont l'id est dans warshIds,
    // elle doit correspondre sur dir, bitrate, labelFr, priority
    meta.ayahReciters.forEach((entry: any) => {
      if (warshIds.has(entry.id)) {
        const manifestEntry = AYAH_RECITERS.find((r) => r.id === entry.id);
        expect(manifestEntry).toBeDefined();
        expect(manifestEntry.dir).toBe(entry.dir);
        expect(manifestEntry.bitrate).toBe(entry.bitrate);
        expect(manifestEntry.labelFr).toBe(entry.labelFr);
        expect(manifestEntry.priority).toBe(entry.priority);
      }
    });
  });

  // 11. AYAH_RECITERS figé, 8 entries, ids distincts
  it("AYAH_RECITERS est figé et a 8 entries avec ids distincts", () => {
    expect(Object.isFrozen(AYAH_RECITERS)).toBe(true);
    expect(AYAH_RECITERS.length).toBe(8);
    const ids = new Set(AYAH_RECITERS.map((r) => r.id));
    expect(ids.size).toBe(8);
  });
});