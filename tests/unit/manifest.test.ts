import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AYAH_RECITERS,
  defaultAyahReciter,
  everyayahBase,
  rewayaReciters,
  selectAyahReciter,
} from "../../scripts/lib/manifest.mjs";
import type { AyahReciter, Riwaya } from "../../src/types";

// `manifest.mjs` est en JS (checkJs false) : le typage de la table est retabli ici,
// comme dans ayah-source.test.ts.
const liste = (r: Riwaya) => rewayaReciters(r) as readonly AyahReciter[];

describe("rewayaReciters", () => {
  it("repartit 1 recitant Warsh et 7 recitants Hafs", () => {
    expect(liste("warsh")).toHaveLength(1);
    expect(liste("hafs")).toHaveLength(7);
  });

  it("porte une riwaya coherente avec la liste dont il vient", () => {
    for (const r of ["warsh", "hafs"] as const) {
      for (const reciter of liste(r)) {
        expect(reciter.riwaya).toBe(r);
      }
    }
  });

  it("ne garde qu'un dossier Warsh et aucun dossier Hafs de prefixe warsh_", () => {
    // Piege du prefixe /data/warsh : un dossier Hafs commence par warsh_ serait
    // resolu deux fois par la meme base.
    expect(liste("warsh").map((r) => r.dir)).toEqual(["warsh_Abdul_Basit_128kbps"]);
    for (const reciter of liste("hafs")) {
      expect(reciter.dir.startsWith("warsh_")).toBe(false);
    }
  });

  it("ordonne les sept dossiers Hafs attendus", () => {
    expect(liste("hafs").map((r) => r.dir)).toEqual([
      "Husary_128kbps",
      "Yasser_Ad-Dussary_128kbps",
      "Minshawy_Murattal_128kbps",
      "Mohammad_al_Tablaway_128kbps",
      "Abdurrahmaan_As-Sudais_192kbps",
      "Hani_Rifai_192kbps",
      "Abdul_Basit_Murattal_192kbps",
    ]);
  });
});

describe("defaultAyahReciter", () => {
  it("choisit l'id 1 en Warsh et l'id 2 en Hafs", () => {
    expect(defaultAyahReciter("warsh").id).toBe(1);
    expect(defaultAyahReciter("hafs").id).toBe(2);
  });

  it("retombe toujours sur un membre de la liste du mode", () => {
    for (const r of ["warsh", "hafs"] as const) {
      const defaut = defaultAyahReciter(r);
      expect(liste(r)).toContainEqual(defaut);
      expect(defaut.riwaya).toBe(r);
    }
  });
});

describe("identifiants des deux modes", () => {
  it("sont disjoints et couvrent exactement 1..8", () => {
    const ids = [...liste("warsh"), ...liste("hafs")].map((r) => r.id);
    // 1 Warsh + 7 Hafs = 8 elements : un Set de taille 8 prouve la disjointete.
    expect(ids).toHaveLength(8);
    expect(new Set(ids)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  });
});

describe("everyayahBase", () => {
  it("separe les deux bases de dossier", () => {
    expect(everyayahBase("warsh")).toBe("https://everyayah.com/data/warsh");
    expect(everyayahBase("hafs")).toBe("https://everyayah.com/data");
  });
});

describe("selectAyahReciter", () => {
  it("resout les ids des deux modes sans ambiguite", () => {
    expect(selectAyahReciter("").id).toBe(1);
    const deux = selectAyahReciter("2");
    expect(deux.id).toBe(2);
    expect(deux.riwaya).toBe("hafs");
    expect(deux.dir).toBe("Husary_128kbps");
    expect(() => selectAyahReciter("9")).toThrow(/inconnu/);
    expect(() => selectAyahReciter("abc")).toThrow(/non numerique/);
  });
});

// Garde-fou anti-derive : meta.json n'est PAS regenere par ce plan (contrainte
// globale) ; il porte encore les trois recitants Warsh d'origine. Les dossiers
// ibrahim_aldosary et yassin ont ete retires du manifeste en tache 2 (404
// cotes everyayah) : le manifeste Warsh n'a plus que l'id 1.
// Ecart au plan : le plan ecrivait « exactement le tableau des recitants
// Warsh », ce qui est impossible tant que meta.json garde ses trois entrees.
// Le test fige donc l'historique de meta.json ET le croise sur le defaut
// Warsh du manifeste : tout changement d'un cote sans l'autre casse ici.
type ChampReciter = {
  id: number;
  dir: string;
  bitrate: number;
  labelFr: string;
  priority: number;
};

const champs = (r: ChampReciter): ChampReciter => ({
  id: r.id,
  dir: r.dir,
  bitrate: r.bitrate,
  labelFr: r.labelFr,
  priority: r.priority,
});

const metaAyahReciters = (): ChampReciter[] => {
  const meta = JSON.parse(readFileSync("src/data/meta.json", "utf8")) as {
    ayahReciters: ChampReciter[];
  };
  return meta.ayahReciters.map(champs);
};

describe("meta.json (anti-derive)", () => {
  it("fige le tableau historique des recitants Warsh", () => {
    expect(metaAyahReciters()).toEqual([
      {
        id: 1,
        dir: "warsh_Abdul_Basit_128kbps",
        bitrate: 128,
        labelFr: "Abdul Baasit (Warsh, 128 kbps)",
        priority: 0,
      },
      {
        id: 2,
        dir: "warsh_ibrahim_aldosary_128kbps",
        bitrate: 128,
        labelFr: "Ibrahim Al-Dosari (Warsh, 128 kbps)",
        priority: 1,
      },
      {
        id: 3,
        dir: "warsh_yassin_al_jazaery_64kbps",
        bitrate: 64,
        labelFr: "Yassin Al-Jazaery (Warsh, 64 kbps)",
        priority: 2,
      },
    ]);
  });

  it("accorde le defaut Warsh du manifeste avec l'entree priority 0 de meta.json", () => {
    const depuisMeta = metaAyahReciters().find((r) => r.priority === 0)!;
    expect(champs(defaultAyahReciter("warsh"))).toEqual(depuisMeta);
  });
});
