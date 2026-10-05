import { describe, expect, it } from "vitest";
import { RIWAYAS, corpusOf } from "../../src/data/corpora";

describe("corpusOf", () => {
  it("renvoie deux objets distincts, jamais la meme reference", () => {
    expect(corpusOf("warsh")).not.toBe(corpusOf("hafs"));
    // Appel reapete : meme riwaya, meme objet (pas de copie a chaque appel).
    expect(corpusOf("warsh")).toBe(corpusOf("warsh"));
  });

  it("porte le meta et les comptes attendus pour Warsh", () => {
    const data = corpusOf("warsh");
    expect(data.meta.riwaya).toBe("warsh");
    expect(data.surahs).toHaveLength(114);
    const total = data.surahs.reduce((n, s) => n + s.a.length, 0);
    expect(total).toBe(6214);
    expect(data.surahs[1].a).toHaveLength(285);
  });

  it("porte le meta et les comptes attendus pour Hafs", () => {
    const data = corpusOf("hafs");
    expect(data.meta.riwaya).toBe("hafs");
    expect(data.surahs).toHaveLength(114);
    const total = data.surahs.reduce((n, s) => n + s.a.length, 0);
    expect(total).toBe(6236);
    expect(data.surahs[1].a).toHaveLength(286);
  });

  it("a des totaux differents : c'est ce qui justifie la double lecture", () => {
    // Si les totaux convergent un jour, la deuxieme riwaya n'a plus de raison
    // d'exister et ce test doit echouer.
    const total = (r: (typeof RIWAYAS)[number]) =>
      corpusOf(r).surahs.reduce((n, s) => n + s.a.length, 0);
    expect(total("warsh")).not.toBe(total("hafs"));
  });

  it("ne livre que des sourates valides (n dans [1, 114], au moins un verset)", () => {
    for (const r of RIWAYAS) {
      for (const s of corpusOf(r).surahs) {
        expect(s.n).toBeGreaterThanOrEqual(1);
        expect(s.n).toBeLessThanOrEqual(114);
        expect(s.a.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("RIWAYAS", () => {
  it("list exactement warsh puis hafs, pour peupler le selecteur de mode", () => {
    expect([...RIWAYAS]).toEqual(["warsh", "hafs"]);
  });
});
