import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Garde-fous sur la feuille de theme.
//
// ATTENTION, ce que ce fichier ne fait PAS : il ne verifie aucun rendu. jsdom n'a pas
// moteur de mise en page — `getComputedStyle` ne calcule ni position, ni centrage. Un
// `text-align` ne peut donc pas etre observe comme comportement. Ces tests lisent la
// source CSS et verifient que les invariants de centrage et d'echelle restent ecrits ; ils
// attrapent la suppression d'une regle ou le retour a une taille figee, pas un defaut de
// rendu. Le seul vrai controle du rendu reste l'application ouverte dans un navigateur.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CSS = readFileSync(join(ROOT, "src", "styles", "app.css"), "utf8");

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Declarations d'une regle de premier niveau, commentaires et blocs @media retires. */
function declarationsFor(css: string, selector: string): string {
  const clean = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Les blocs @media se terminent par une accolade seule en debut de ligne.
    .replace(/@media[^{]*\{[\s\S]*?\n\}/g, "");
  // Ancre sur `^` ou `}` : la regle doit commencer le bloc, ce qui empeche
  // `.ayah-marker` de matcher `.ayah[data-active="true"] .ayah-marker`.
  const match = new RegExp(`(?:^|\\})\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`).exec(clean);
  if (!match) throw new Error(`regle absente de app.css : ${selector}`);
  return match[1];
}

const propertyOf = (declarations: string, property: string): string | undefined =>
  new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(declarations)?.[1].trim();

describe("centrage du verset", () => {
  // Le medaillon est une boite de niveau INLINE : sa position horizontale vient du
  // `text-align` de son parent, pas du sien. Sans `text-align: center` sur `.ayah`,
  // il se colle au bord gauche du bloc. C'est le bug corrige ici.
  it(".ayah-marker est une boite inline, donc c'est .ayah qui doit centrer", () => {
    expect(propertyOf(declarationsFor(CSS, ".ayah-marker"), "display")).toBe("inline-flex");
    expect(propertyOf(declarationsFor(CSS, ".ayah"), "text-align")).toBe("center");
  });

  // Les deux autres enfants sont des blocs qui se centrent eux-memes ; ils doivent
  // conserver leur propre `text-align` et ne pas dependre de l'heritage.
  it("chaque enfant du verset se centre explicitement", () => {
    for (const selector of [".ayah-text", ".ayah-ref"]) {
      expect(propertyOf(declarationsFor(CSS, selector), "display"), selector).toBe("block");
      expect(propertyOf(declarationsFor(CSS, selector), "text-align"), selector).toBe("center");
    }
  });
});

describe("colonne de lecture", () => {
  it("est centree et de largeur bornee", () => {
    expect(propertyOf(declarationsFor(CSS, ".ayah-list-container"), "margin")).toBe("0 auto");
    expect(propertyOf(declarationsFor(CSS, ".ayah-list-container"), "max-width")).toBeTruthy();
  });

  // Sans `list-style: none`, la numerotation native de <ol> s'affiche en plus du
  // medaillon — deux numeros pour le meme verset.
  it("supprime la numerotation native du <ol>", () => {
    expect(propertyOf(declarationsFor(CSS, ".ayah-list"), "list-style")).toBe("none");
  });
});

describe("echelle proportionnelle a la largeur", () => {
  // Un `clamp` a trois termes : plancher (trop petit = illisible sur telephone),
  // valeur proportionnelle a la fenetre, plafond (trop grand = mur de lignes sur
  // tres grand ecran). Perdre un terme, ou revenir a une taille en rem figee,
  // casse la promesse "les versets remplissent la largeur".
  it("--corps-verset est un clamp a plancher et plafond", () => {
    const corps = propertyOf(declarationsFor(CSS, ":root"), "--corps-verset");
    expect(corps).toMatch(/^clamp\(/);
    // Le terme central doit dependre de la largeur de la fenetre.
    expect(corps).toMatch(/vw/);
    expect(corps!.split(",")).toHaveLength(3);
  });

  // Le point de depart : si `.ayah-text` repasse en taille absolue, tout le reste
  // (qui se derive de la variable) devient incoherent sans qu'aucun autre test ne le voie.
  it("le verset consomme la variable et non une taille figee", () => {
    const fontSize = propertyOf(declarationsFor(CSS, ".ayah-text"), "font-size");
    expect(fontSize).toBe("var(--corps-verset)");
    expect(fontSize).not.toMatch(/rem|px/);
  });

  // Chaque element dimensionne a l'echelle du texte doit se servir de la meme variable.
  // Une valeur en rem ici suffit a desynchroniser le medaillon du verset.
  it("les elements a l'echelle du texte derivent tous de la variable", () => {
    const derived: Array<[string, string]> = [
      [".ayah-marker", "font-size"],
      [".surah-heading", "font-size"],
      [".ayah-ref", "font-size"],
      [".ayah-marker", "width"],
      [".ayah-marker", "height"],
      [".ayah", "padding"],
    ];
    for (const [selector, property] of derived) {
      const value = propertyOf(declarationsFor(CSS, selector), property);
      expect(value, `${selector} { ${property} }`).toContain("var(--corps-verset)");
    }
  });

  // Le medaillon est un disque : `border-radius: 50%` ne rend un cercle que si la
  // boite est carree. Une hauteur derivee et une largeur fixe (ou l'inverse) donne
  // une ellipse silencieusement.
  it("le medaillon reste carre", () => {
    expect(propertyOf(declarationsFor(CSS, ".ayah-marker"), "width")).toBe(
      propertyOf(declarationsFor(CSS, ".ayah-marker"), "height"),
    );
  });
});