# Plan 1 — Socle : pipeline de données, moteur de synchronisation, lecteur

> **Source de vérité** : `docs/2026-09-27-coran-warsh-design.md`
> **Statut** : à exécuter
> **Prérequis** : Node ≥ 20.19 (vérifié en 25.9.0), aucune donnée inventée — toute valeur
> non vérifiée est obtenue par une tâche explicite avant d'être codée en dur.

---

## Pourquoi ce découpage

Le design décrit 4 phases. Ce plan ne traite que la **phase 1 (Socle)**. Les phases suivantes
seront des plans séparés, écrits **après** exécution de celui-ci, car leurs données dépendent des
types et des invariants établis ici :

| Plan | Contenu | Dépend de |
|---|---|---|
| **1 — Socle** (ce plan) | scaffold, ingest texte+timings+police, moteur de sync, lecteur | — |
| 2 — Page du Coran | SVG, zoom, coordinate → ayah, tap-to-seek | types `Surah`/`TimingRow` du plan 1 |
| 3 — Recherche et signets | index inversé, surlignage, signets, URL state | `AyahRow.text` du plan 1 |
| 4 — i18n et finitions | FR/EN/AR, thèmes, a11y, PWA | composants du plan 1 |

Ce plan produit à son terme **une application fonctionnelle** : on ouvre une sourate, on lit le
texte Uthmanic dans la bonne police, on écoute le récitant par défaut, l'ayah en cours est
surligné en synchronisation.

---

## Versions vérifiées (registre npm, 2026-09-27)

| Paquet | Version épinglée | Note |
|---|---|---|
| `vite` | `^8.3.1` | `engines: ^20.19.0 \|\| >=22.12.0` — OK sur Node 25.9 |
| `@vitejs/plugin-react` | `^6.1.1` | peer `vite ^8.0.0` ; autres peers **optionnels** |
| `vitest` | `^4.1.11` | **PAS 5.x** : Vitest 5 exige `^22.12 \|\| ^24 \|\| >=26` et exclut Node 25. Vitest 4 accepte `>=24` |
| `react` / `react-dom` | `^19.3.0` | |
| `typescript` | `~5.9.3` | **PAS 7.x** (port natif Go, tout juste sorti) : on reste sur la ligne éprouvée |
| `@playwright/test` | `^1.63.0` | |
| `jsdom` | `^30.1.1` | |
| `@testing-library/react` | `^16.3.3` | |
| `@testing-library/jest-dom` | `^7.0.1` | |
| `@testing-library/user-event` | `^14.6.7` | |
| `@types/react`, `@types/react-dom` | `^19.3.0` | |
| `@types/node` | `^26.6.3` | |
| `quran-meta` | `^7.0.0` | MIT — corroboration `findPage`/`findJuz` + conversions. **devDependency** |

---

## Structure de fichiers cible

```
coran/
├── docs/
│   ├── 2026-09-27-coran-warsh-design.md
│   └── superpowers/plans/2026-09-27-coran-socle.md
├── .gitignore                      # .cache/ déjà ignoré — ne rien ajouter
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── playwright.config.ts
├── scripts/
│   ├── ingest.mjs                  # orchestrateur CLI
│   ├── lib/
│   │   ├── manifest.mjs            # sources, digests, invariantes
│   │   ├── verify.mjs              # md5/sha256 fichier & buffer
│   │   ├── text.mjs                # garde-fou codepoints étendus
│   │   ├── parse-kfgqpc.mjs        # JSON officiel -> structure compacte
│   │   ├── corroborate.mjs         # cross-check quran-meta (pages, juz)
│   │   ├── timings.mjs              # normalisation snake_case + exact|partial|estimated
│   │   ├── estimate.mjs            # queue estimée proportionnelle aux mots
│   │   └── io.mjs                  # écriture JSON atomique
│   └── fixtures/
│       ├── juz-divergence.json     # les 17 ayat, figés
│       └── surah-counts.json       # 114 comptes, figés
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts
│   ├── data/                       # GÉNÉRÉ par l'ingest, COMMITÉ
│   │   ├── quran-warsh.json
│   │   ├── meta.json
│   │   ├── ingest-report.json
│   │   └── timings/120/1.json … 114.json   # 120 = moshaf Warsh, PAS 118 (Hafs)
│   ├── assets/fonts/kfgqpc_warsh_v30.ttf
│   ├── styles/fonts.css
│   ├── sync/
│   │   ├── timing-index.ts
│   │   └── use-sync-engine.ts
│   ├── state/session.ts
│   └── components/
│       ├── AyahList.tsx
│       ├── AyahItem.tsx
│       ├── SurahPicker.tsx
│       └── PlayerBar.tsx
└── tests/
    ├── setup.ts
    ├── unit/                       # node + jsdom selon le fichier
    └── e2e/
        ├── wav.ts                   # synthétiseur de WAV silencieux
        └── *.spec.ts
```

---

## Invariants figés (vérifiés le 2026-09-27 sur le paquet officiel)

| Invariant | Valeur |
|---|---|
| Ayat total | **6214** |
| `id` | contigus `1..6214` |
| Sourates | **114** |
| Pages | **604** (min 1, max 604) |
| Juz | **30** (min 1, max 30) |
| Comptes de sourate (Warsh) | 1→7, 2→285, 3→200, 110→3, 112→4, 114→6 (liste complète dans `scripts/fixtures/surah-counts.json`) |
| Comptes qui divergent du Hafs | **50 sourates sur 114**. Warsh 6214 vs Hafs 6236 (Δ −22). La divergence est **bidirectionnelle** : 18 sourates ont *plus* d'ayat en Warsh (max +3, ex. 56→99 vs 96), 32 en ont *moins* (max −5, ex. 18→105 vs 110). Conséquence : **aucun offset global n'existe** entre les deux riwayas, tout index d'ayah Hafs est inutilisable ici. Liste exacte : `scripts/fixtures/surah-counts.json` (Warsh) comparé à `quran-meta/hafs` |
| Codepoints étendus | **14** : U+0870, U+0872, U+0873, U+0874, U+0876, U+0878, U+0879, U+0887, U+0888, U+08C9, U+08CC, U+08F0, U+08F1, U+08F2 |
| Écarts de juz vs `quran-meta` | **17** (liste complète dans `scripts/fixtures/juz-divergence.json`) |
| Écarts de page vs `quran-meta` | **0** |
| SHA-256 du ZIP | `b2436cc201cddd3e456aba708b0a2e5b851ce6c5a3405db932fd07db612f8650` |
| MD5 du JSON | `03ba2b6147d7ca35c96166a3fbfe2ee1` |
| MD5 du TTF | `1417f8f6397aec787f5862733a423762` |
| Récitant **timings** | moshaf Warsh `id=120` de l'API, donc **`read=120`** (`rewaya_id=2`) — voir §révocation ci-dessous |
| Hôte audio Warsh | `https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi/` → `200 audio/mpeg` |
| Hôte audio Hafs | `https://server8.mp3quran.net/husr/` → **502 (mort)** |
| `aya_text_emlaey` | **inexistant** pour le Warsh — aucun repli texte possible |

> ### ⚠ Révocation du 2026-09-27 — `read=118` est Hafs, pas Warsh
>
> Une version antérieure de ce plan figeait `read=118` (récitant Al-Husary) pour les timings.
> **C'est faux et c'est le défaut silencieux le plus grave du plan** : l'endpoint
> `ayat_timing` applique le moshaf *par défaut* du récitant, or le moshaf par défaut de
> `118` est **Hafs A'n Assem**. Mesuré sur les 114 sourates :
>
> | | `read=118` (Hafs) | `read=120` (Warsh) | KFGQPC canonique |
> |---|---|---|---|
> | Total d'entrées | 6349 | **6214** | **6214** |
> | Sourates divergentes | **51 / 114** | **0 / 114** | — |
> | Basmala synthétique `ayah:0` | oui (114/114) | **non** | — |
>
> Avec `read=120` le total est **exactement 6214**, zéro divergence, et `ayah` va de `1..N`
> en correspondance directe avec `aya_no` de KFGQPC — **sans basmala synthétique et sans
> offset**. Le détail des observations est figé dans
> [`2026-09-27-reseau-verifie.md`](2026-09-27-reseau-verifie.md) ; toutes les tâches
> concernées ont été réécrites en conséquence.

**Piège connu** : `quran-meta/warsh` expose `getAyahMeta(surah, ayah)` qui renvoie des `page`
erronées (`page: 1` pour `2:1`, soit 12274 faux écarts). **Utiliser uniquement `findPage(surah, ayah)`
et `findJuz(surah, ayah)`.** Un test le verrouille.

---

## Discipline TDD

Pour chaque tâche : écrire le test d'abord, **exécuter et constater l'échec**, puis implémenter,
puis exécuter et constater le passe. Un commit par tâche. Ne pas écrire de code de production
avant d'avoir vu son test échouer.

Le test doit échouer **pour la bonne raison** (assertion métier), pas pour une erreur de syntaxe
ou d'import.

---

## Tâche 0 — Pré-vol réseau : figer les URL et le schéma distant — **FAITE (2026-09-27)**

On ne suppose rien de l'API mp3quran ni de l'hôte audio. Cette tâche observe, consigne, et
**échoue explicitement** si quoi que ce soit ne correspond pas.

**Créé** : `docs/superpowers/plans/2026-09-27-reseau-verifie.md` — commit `109b7c5`.

> **Résultat : la tâche a échoué, comme prévu.** L'étape 5 n'autorisait que « corriger la
> section Étape 2 de la tâche 5 ». Les observations ont dépassé ce cadre : l'identifiant de
> récitant lui-même était faux (Hafs au lieu de Warsh), ce qui invalidait les tâches 5, 12,
> `App.tsx` et leurs tests. Le plan a été **réécrit** et la présente tâche close.
> Détail : [`2026-09-27-reseau-verifie.md`](2026-09-27-reseau-verifie.md).

**Ce qui a été observé (et qui remplace toutes les hypothèses ci-dessous)**

| Hypothèse du plan | Observation |
|---|---|
| `read=118` = Warsh | **`read=118` est Hafs.** Warsh = **`read=120`** (moshaf `id=120`, `rewaya_id=2`) |
| `https://mp3quran.net/api/v3/ayah_timings` | **404.** Correct : `https://www.mp3quran.net/api/v3/ayat_timing` (singulier, hôte `www.`, suivre le **301**) |
| `[{ surah, ayahs: [...] }]` | **tableau plat** d'ayat |
| `start` / `end` | **`start_time` / `end_time`**, entiers **millisecondes** |
| `segments` | **`polygon`** (points SVG `"x,y x,y …"`) + `x`, `y`, `page` |
| `page` numérique | **`page` est une URL de SVG** (`…/api/quran_pages_svg/002.svg`) |
| `payload[0].audio` | **champ inexistant** — l'audio se reconstruit depuis `reciters` |
| basmala synthétique | **inexistante** avec `read=120` ; `ayah` = `1..N` aligné sur `aya_no` |
| géométrie complète | **26 ayat sur 6214** sans `polygon`/`page` (queues de 18 sourates) |

L'hôte Hafs `server8.mp3quran.net/husr/` est en outre **502 (mort)**, et l'endpoint timings
`read=120` sert **exactement 6214** ayat sur les 114 sourates, **zéro divergence** avec
KFGQPC. Les quatre sondes audio de l'étape 1 (`server13` Warsh, `server8` Hafs) restent
valides et ont été rejouées.

---

## Tâche 1 — Scaffold Vite + React + TS + Vitest

**Fichiers** : `package.json`, `index.html`, `tsconfig.json`, `tsconfig.node.json`,
`vite.config.ts`, `tests/setup.ts`, `src/main.tsx`, `src/App.tsx`

**Étapes**

1. `npm init -y` puis écrire `package.json` avec les versions du tableau ci-dessus et les scripts :

   ```json
   {
     "name": "coran",
     "private": true,
     "version": "0.1.0",
     "type": "module",
     "scripts": {
       "ingest": "node scripts/ingest.mjs",
       "dev": "vite",
       "build": "tsc -b && vite build",
       "preview": "vite preview",
       "typecheck": "tsc -b",
       "test": "vitest run",
       "test:watch": "vitest",
       "e2e": "playwright test"
     }
   }
   ```

2. `npm install` avec les versions ci-dessus, `npm install -D` pour les devDependencies.
   `@types/node` est **obligatoire** : les tests et `tests/e2e/wav.ts` utilisent `node:fs`,
   `node:path` et `Buffer`.

3. `vite.config.ts` — un seul fichier pour Vite **et** Vitest, afin que `vite build` ait le
   plugin React. Ne pas séparer la config de test dans un second fichier, sinon le build
   echoue a transformer le JSX.

   ```ts
   import react from "@vitejs/plugin-react";
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: "node",
       setupFiles: ["./tests/setup.ts"],
       // `.tsx` obligatoire : les tests de composants sont des .tsx
       include: ["tests/unit/**/*.test.{ts,tsx}"],
       exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
     },
   });
   ```

4. `tests/setup.ts` — matchers Jest-DOM **et** nettoyage automatique entre tests :

   ```ts
   import "@testing-library/jest-dom/vitest";
   import { cleanup } from "@testing-library/react";
   import { afterEach } from "vitest";

   // Sans ca, le DOM accumule les rendus et les `getByTestId` deviennent ambigus.
   afterEach(() => {
     cleanup();
   });
   ```

5. `index.html` avec `<div id="root"></div>` et `<script type="module" src="/src/main.tsx">`.

6. `src/main.tsx` : monte `App` dans `#root` via `createRoot`.

7. `src/App.tsx` : rend `<h1>Coran — Warsh</h1>` pour l'instant.

8. `tsconfig.json` — projet applicatif :

   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2022", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "jsx": "react-jsx",
       "strict": true,
       "noEmit": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "allowJs": true,
       "checkJs": false,
       "types": ["node"]
     },
     "include": ["src", "tests"]
   }
   ```

   > `types: ["node"]` et non `["vitest/globals"]` : tous les tests importent
   > explicitement de `vitest`, les globales ne sont pas utilisees.

9. `tsconfig.node.json` — pour `vite.config.ts` et `playwright.config.ts` :

   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2023"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "composite": true,
       "noEmit": false,
       "emitDeclarationOnly": true,
       "outDir": "./node_modules/.tmp/tsconfig.node",
       "strict": true,
       "types": ["node"]
     },
     "include": ["vite.config.ts", "playwright.config.ts", "tests/e2e"]
   }
   ```

   Le `tsconfig.json` racine doit référencer ce fichier via `"references"` pour que
   `tsc -b` typecheck aussi les configs.

**Test d'abord** — `tests/unit/scaffold.test.tsx` :

```tsx
/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App";

describe("scaffold", () => {
  it("affiche le titre", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /coran/i })).toBeInTheDocument();
  });
});
```

Le test échoue (import introuvable) → implémenter → `npm test` passe.

**Vérifier** : `npm test` puis `npm run build`.

**Commit** : `chore: scaffold vite + react + ts + vitest`

---

## Tâche 2 — Manifeste des sources et vérification d'intégrité

**Fichiers** : `scripts/lib/manifest.mjs`, `scripts/lib/verify.mjs`, `tests/unit/verify.test.ts`

**Test d'abord** — `tests/unit/verify.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp, writeFileSync } from "node:fs";
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
```

**Implémentation** — `scripts/lib/verify.mjs` :

```js
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function md5Hex(data) {
  return createHash("md5").update(data).digest("hex");
}

export async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
```

**Implémentation** — `scripts/lib/manifest.mjs` :

```js
export const KFGQPC = Object.freeze({
  id: "kfgqpc_warsh_v30",
  publisher: "Complexe du Roi Fahd",
  portalUrl: "https://qurancomplex.gov.sa/quran-dev/",
  // KFC ne publie aucune licence explicite pour ce corpus : on ne l'invente pas.
  // `license: null` est un fait, `licenseNote` porte la nuance et l'empreinte reste
  // la preuve de ce qui a ete distribue.
  license: null,
  licenseNote:
    "Aucune licence explicite publiee par le Complexe du Roi Fahd pour ce corpus. " +
    "Usage documentaire assume par le developpeur ; redistribution a valider aupres du " +
    "source avant toute mise en production publique.",
  zipSha256: "b2436cc201cddd3e456aba708b0a2e5b851ce6c5a3405db932fd07db612f8650",
  json: Object.freeze({
    path: "kfgqpc_warsh_v30-data/kfgqpc_warsh_v30.json",
    md5: "03ba2b6147d7ca35c96166a3fbfe2ee1",
  }),
  ttf: Object.freeze({
    path: "kfgqpc_warsh_v30-font/kfgqpc_warsh_v30.ttf",
    md5: "1417f8f6397aec787f5862733a423762",
  }),
  expected: Object.freeze({
    ayahCount: 6214,
    surahCount: 114,
    pageCount: 604,
    juzCount: 30,
  }),
});

export const QURAN_META = Object.freeze({
  id: "quran-meta",
  version: "7.0.0",
  license: "MIT",
  // Accesseurs de reference. getAyahMeta() est errone sur les pages : ne pas l'utiliser.
  pageAccessor: "findPage",
  juzAccessor: "findJuz",
});

// Recitant 118 = Mahmoud Khalil Al-Husary. Son moshaf par defaut (id 118) est Hafs A'n
// Assem : l'utiliser pour les timings fausse le survol sur 51 sourates sur 114.
// Warsh est le moshaf id 120 du meme recitant (rewaya_id 2, Murattal).
// `id` est donc l'identifiant de MOSHAF, pas de recitant.
export const RECITERS = Object.freeze([
  Object.freeze({
    id: 120,
    reciterId: 118,
    rewayaId: 2,
    moshafType: 21,
    label: "Rewayat Warsh A'n Nafi' - Murattal",
    labelFr: "Récitation de Warsh 'an Nafi' (Murattal)",
    server: "https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi",
    priority: 0,
  }),
]);

export function selectReciter(raw) {
  if (raw === undefined || raw === "") return RECITERS[0];
  if (!/^\d+$/.test(raw)) {
    throw new Error(`identifiant de recitant non numerique: ${raw}`);
  }
  const id = Number(raw);
  const found = RECITERS.find((r) => r.id === id);
  if (!found) throw new Error(`recitant inconnu dans le manifeste: ${id}`);
  return found;
}

// Verifie le 2026-09-27 : `ayah_timings` et l'hote nu renvoient 404. Le nom est
// `ayat_timing` (singulier) et l'hote doit porter le prefixe `www.` (301 vers la locale).
export const TIMINGS_ENDPOINT =
  "https://www.mp3quran.net/api/v3/ayat_timing?surah={surah}&read={reciter}";

export const RECITERS_ENDPOINT = "https://www.mp3quran.net/api/v3/reciters?language=eng";

// La reponse timings ne contient AUCUN champ `audio` : l'URL doit etre reconstruite.
// `server` ci-dessus est donc autoritaire, pas un repli. La branche Warsh est obligatoire :
// `server8.../husr/` sert la recitation Hafs et repond 502 de toute facon.
export const AUDIO_BASE = "https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi";
```

**Vérifier** : `npm test`

**Commit** : `feat(ingest): manifeste des sources et verification d'integrite`

---

## Tâche 3 — Garde-fou sur les codepoints étendus

**Fichiers** : `scripts/lib/text.mjs`, `tests/unit/text.test.ts`

C'est la fonction qui empêche une régression silencieuse du texte coranique : si KFGQPC publie un
jour un 15ᵉ codepoint, ou si quelqu'un normalise le texte par accident, l'ingest s'arrête.

**Test d'abord** — `tests/unit/text.test.ts` :

```ts
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
```

**Implémentation** — `scripts/lib/text.mjs` :

```js
export const EXTENDED_RANGE = Object.freeze({ start: 0x870, end: 0x8ff });

export const KNOWN_KFGQPC_CODEPOINTS = Object.freeze([
  0x870, 0x872, 0x873, 0x874, 0x876, 0x878, 0x879, 0x887, 0x888, 0x8c9, 0x8cc, 0x8f0, 0x8f1, 0x8f2,
]);

const KNOWN = new Set(KNOWN_KFGQPC_CODEPOINTS);

export function findUnknownExtendedCodepoints(text) {
  const unknown = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= EXTENDED_RANGE.start && cp <= EXTENDED_RANGE.end && !KNOWN.has(cp)) {
      unknown.add(cp);
    }
  }
  return [...unknown]
    .sort((a, b) => a - b)
    .map((c) => `U+${c.toString(16).toUpperCase().padStart(4, "0")}`);
}

export const AYAH_END_MARKER = "\u06DD";

// Le suffixe est inseparable : NBSP eventuel + marqueur + numero en chiffres
// arabes-indiques. On ne retire ni le marqueur seul, ni les chiffres seuls.
const AYAH_END_SUFFIX = /\u00A0?\u06DD[\u0660-\u0669]+/g;

export function stripAyahEndMarker(text) {
  return text.replace(AYAH_END_SUFFIX, "").replaceAll("\u00A0", " ").trim();
}
```

**Vérifier** : `npm test`

**Commit** : `feat(ingest): garde-fou sur les 14 codepoints etendus KFGQPC`

---

## Tâche 4 — Parser KFGQPC et fixtures de référence

**Fichiers** : `scripts/lib/parse-kfgqpc.mjs`, `scripts/fixtures/surah-counts.json`,
`scripts/fixtures/juz-divergence.json`, `tests/unit/parse-kfgqpc.test.ts`

**Test d'abord** — `tests/unit/parse-kfgqpc.test.ts` :

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IngestError, parseKfgqpc } from "../../scripts/lib/parse-kfgqpc.mjs";
import surahCounts from "../../scripts/fixtures/surah-counts.json" with { type: "json" };

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  jozz: 1,
  page: 1,
  sura_no: 1,
  sura_name_en: "Al-Fatihah",
  sura_name_ar: "الفاتحة",
  line_start: 1,
  line_end: 1,
  aya_no: 1,
  aya_text_unicode: "بِسْمِ",
  ...over,
});

// jeu complet valide pilote par la fixture des comptes Warsh
const fullRows = () => {
  const counts = Object.values(surahCounts);
  const out: Record<string, unknown>[] = [];
  let id = 1;
  for (let n = 1; n <= 114; n += 1) {
    for (let a = 1; a <= counts[n - 1]; a += 1) {
      out.push(row({ id, sura_no: n, aya_no: a, page: 1, jozz: 1 }));
      id += 1;
    }
  }
  return out;
};

describe("parseKfgqpc", () => {
  it("refuse un tableau vide", () => {
    expect(() => parseKfgqpc([])).toThrow(IngestError);
  });

  it("refuse un compte d'ayat inattendu", () => {
    expect(() => parseKfgqpc([row()])).toThrow(/6214/);
  });

  it("refuse un id discontinu", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    rows[10] = row({ id: 12 });
    expect(() => parseKfgqpc(rows)).toThrow(/discontinu/i);
  });

  it("refuse un champ manquant", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    delete (rows[0] as Record<string, unknown>).jozz;
    expect(() => parseKfgqpc(rows)).toThrow(/champ manquant/i);
  });

  it("refuse un champ inattendu", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    (rows[0] as Record<string, unknown>).aya_text_emlaey = "x";
    expect(() => parseKfgqpc(rows)).toThrow(/champ inattendu/i);
  });

  it("refuse une page hors bornes", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    rows[0] = row({ id: 1, page: 605 });
    expect(() => parseKfgqpc(rows)).toThrow(/page hors bornes/i);
  });

  it("refuse un codepoint etendu inconnu", () => {
    const rows = Array.from({ length: 6214 }, (_, i) => row({ id: i + 1 }));
    rows[0] = row({ id: 1, aya_text_unicode: "خ\u0890" });
    expect(() => parseKfgqpc(rows)).toThrow(/U\+0890/);
  });

  it("refuse un champ numerique non entier", () => {
    const rows = fullRows();
    rows[0] = row({ id: 1, page: "2" });
    expect(() => parseKfgqpc(rows)).toThrow(/entier/);
  });

  it("accepte un jeu complet valide et rend 114 sourates", () => {
    const out = parseKfgqpc(fullRows());
    expect(out.meta.ayahCount).toBe(6214);
    expect(out.meta.surahCount).toBe(114);
    expect(out.surahs[0].n).toBe(1);
    expect(out.surahs[0].a).toHaveLength(7);
    expect(out.surahs[1].a).toHaveLength(285);
    expect(out.surahs.at(-1)!.n).toBe(114);
    expect(out.surahs.at(-1)!.a).toHaveLength(6);
  });

  it("applique stripAyahEndMarker au texte de chaque ayah", () => {
    const rows = fullRows();
    rows[0] = row({ id: 1, sura_no: 1, aya_no: 1, aya_text_unicode: "بِسْمِ\u00A0\u06DD\u0661" });
    const out = parseKfgqpc(rows);
    expect(out.surahs[0].a[0][2]).toBe("بِسْمِ");
  });

  it("respecte les comptes de sourate figes", () => {
    expect(surahCounts["1"]).toBe(7);
    expect(surahCounts["2"]).toBe(285);
    expect(surahCounts["3"]).toBe(200);
    expect(surahCounts["110"]).toBe(3);
    expect(surahCounts["112"]).toBe(4);
    expect(surahCounts["114"]).toBe(6);
    expect(Object.keys(surahCounts)).toHaveLength(114);
    expect(Object.values(surahCounts).reduce((a, b) => a + b, 0)).toBe(6214);
  });
});
```

**Implémentation** — `scripts/lib/parse-kfgqpc.mjs` :

```js
import { KFGQPC } from "./manifest.mjs";
import { findUnknownExtendedCodepoints, stripAyahEndMarker } from "./text.mjs";

export class IngestError extends Error {
  constructor(message) {
    super(message);
    this.name = "IngestError";
  }
}

const SCHEMA = [
  "id",
  "jozz",
  "page",
  "sura_no",
  "sura_name_en",
  "sura_name_ar",
  "line_start",
  "line_end",
  "aya_no",
  "aya_text_unicode",
];

const NUMERIC = ["id", "jozz", "page", "sura_no", "line_start", "line_end", "aya_no"];

export function parseKfgqpc(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new IngestError("kfgqpc: tableau vide ou invalide");
  }
  if (rows.length !== KFGQPC.expected.ayahCount) {
    throw new IngestError(
      `kfgqpc: ${rows.length} ayat recus, ${KFGQPC.expected.ayahCount} attendus`,
    );
  }

  const surahs = new Map();

  for (const [i, r] of rows.entries()) {
    const line = i + 1;
    const keys = Object.keys(r);
    for (const k of SCHEMA) {
      if (!keys.includes(k)) throw new IngestError(`kfgqpc: champ manquant ${k} (ligne ${line})`);
    }
    for (const k of keys) {
      if (!SCHEMA.includes(k)) {
        throw new IngestError(`kfgqpc: champ inattendu ${k} (ligne ${line})`);
      }
    }
    if (r.id !== line) throw new IngestError(`kfgqpc: id discontinu ligne ${line} (${r.id})`);
    for (const k of NUMERIC) {
      if (!Number.isInteger(r[k])) {
        throw new IngestError(`kfgqpc: ${k} n'est pas un entier (ligne ${line})`);
      }
    }
    if (r.sura_no < 1 || r.sura_no > KFGQPC.expected.surahCount) {
      throw new IngestError(`kfgqpc: sura_no hors bornes ${r.sura_no} (ligne ${line})`);
    }
    if (r.page < 1 || r.page > KFGQPC.expected.pageCount) {
      throw new IngestError(
        `kfgqpc: page hors bornes ${r.page} — ${r.sura_no}:${r.aya_no}`,
      );
    }
    if (r.jozz < 1 || r.jozz > KFGQPC.expected.juzCount) {
      throw new IngestError(
        `kfgqpc: jozz hors bornes ${r.jozz} — ${r.sura_no}:${r.aya_no}`,
      );
    }
    if (r.aya_no < 1) {
      throw new IngestError(`kfgqpc: aya_no invalide ${r.aya_no} (ligne ${line})`);
    }
    if (typeof r.aya_text_unicode !== "string" || r.aya_text_unicode.length === 0) {
      throw new IngestError(`kfgqpc: texte vide (ligne ${line})`);
    }
    const unknown = findUnknownExtendedCodepoints(r.aya_text_unicode);
    if (unknown.length > 0) {
      throw new IngestError(
        `kfgqpc: codepoints etendus inconnus ${unknown.join(" ")} — ${r.sura_no}:${r.aya_no}`,
      );
    }

    let surah = surahs.get(r.sura_no);
    if (!surah) {
      surah = { n: r.sura_no, en: r.sura_name_en, ar: r.sura_name_ar, a: [] };
      surahs.set(r.sura_no, surah);
    }
    const expectedAyah = surah.a.length + 1;
    if (r.aya_no !== expectedAyah) {
      throw new IngestError(
        `kfgqpc: ayah non contigu dans la sourate ${r.sura_no} : attendu ${expectedAyah}, recu ${r.aya_no}`,
      );
    }
    surah.a.push([r.jozz, r.page, stripAyahEndMarker(r.aya_text_unicode)]);
  }

  const list = [...surahs.values()].sort((x, y) => x.n - y.n);
  if (list.length !== KFGQPC.expected.surahCount) {
    throw new IngestError(`kfgqpc: ${list.length} sourates, ${KFGQPC.expected.surahCount} attendues`);
  }
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].n !== i + 1) {
      throw new IngestError(`kfgqpc: sourate ${i + 1} absente`);
    }
  }

  return {
    meta: {
      riwaya: "warsh",
      source: KFGQPC.id,
      ayahCount: rows.length,
      surahCount: list.length,
      pageCount: KFGQPC.expected.pageCount,
      juzCount: KFGQPC.expected.juzCount,
    },
    surahs: list,
  };
}
```

**Fixtures** — générer `scripts/fixtures/surah-counts.json` à partir du paquet officiel avec un
script jetable, puis **vérifier** que la somme vaut 6214 :

```json
{ "1": 7, "2": 285, "3": 200, "4": 175, "5": 122, "6": 167, "7": 206, "8": 76, "9": 130,
  "10": 109, "11": 121, "12": 111, "13": 44, "14": 54, "15": 99, "16": 128, "17": 110,
  "18": 105, "19": 99, "20": 134, "21": 111, "22": 76, "23": 119, "24": 62, "25": 77,
  "26": 226, "27": 95, "28": 88, "29": 69, "30": 59, "31": 33, "32": 30, "33": 73,
  "34": 54, "35": 46, "36": 82, "37": 182, "38": 86, "39": 72, "40": 84, "41": 53,
  "42": 50, "43": 89, "44": 56, "45": 36, "46": 34, "47": 39, "48": 29, "49": 18,
  "50": 45, "51": 60, "52": 47, "53": 61, "54": 55, "55": 77, "56": 99, "57": 28,
  "58": 21, "59": 24, "60": 13, "61": 14, "62": 11, "63": 11, "64": 18, "65": 12,
  "66": 12, "67": 31, "68": 52, "69": 52, "70": 44, "71": 30, "72": 28, "73": 18,
  "74": 55, "75": 39, "76": 31, "77": 50, "78": 40, "79": 45, "80": 42, "81": 29,
  "82": 19, "83": 36, "84": 25, "85": 22, "86": 17, "87": 19, "88": 26, "89": 32,
  "90": 20, "91": 15, "92": 21, "93": 11, "94": 8, "95": 8, "96": 20, "97": 5,
  "98": 8, "99": 9, "100": 11, "101": 10, "102": 8, "103": 3, "104": 9, "105": 5,
  "106": 5, "107": 6, "108": 3, "109": 6, "110": 3, "111": 5, "112": 4, "113": 5,
  "114": 6 }
```

**Fixture** — `scripts/fixtures/juz-divergence.json` (les 17, mesurés le 2026-09-27) :

```json
[
  { "ayah": "2:141",  "kfc": 2,  "meta": 1  },
  { "ayah": "2:251",  "kfc": 3,  "meta": 2  },
  { "ayah": "2:252",  "kfc": 3,  "meta": 2  },
  { "ayah": "3:91",   "kfc": 4,  "meta": 3  },
  { "ayah": "3:92",   "kfc": 4,  "meta": 3  },
  { "ayah": "4:147",  "kfc": 6,  "meta": 5  },
  { "ayah": "5:82",   "kfc": 6,  "meta": 7  },
  { "ayah": "5:83",   "kfc": 6,  "meta": 7  },
  { "ayah": "6:111",  "kfc": 7,  "meta": 8  },
  { "ayah": "7:87",   "kfc": 9,  "meta": 8  },
  { "ayah": "9:93",   "kfc": 10, "meta": 11 },
  { "ayah": "18:74",  "kfc": 16, "meta": 15 },
  { "ayah": "27:56",  "kfc": 19, "meta": 20 },
  { "ayah": "27:57",  "kfc": 19, "meta": 20 },
  { "ayah": "36:27",  "kfc": 23, "meta": 22 },
  { "ayah": "39:31",  "kfc": 24, "meta": 23 },
  { "ayah": "41:46",  "kfc": 25, "meta": 24 }
]
```

**Vérifier** : `npm test`

**Commit** : `feat(ingest): parseur KFGQPC et fixtures de reference`

---

## Tâche 5 — Normalisation, classification et estimation des timings

**Fichiers** : `scripts/lib/timings.mjs`, `scripts/lib/estimate.mjs`,
`tests/unit/timings.test.ts`, `tests/unit/estimate.test.ts`

> **Réécrit le 2026-09-27** d'après [`2026-09-27-reseau-verifie.md`](2026-09-27-reseau-verifie.md).
> La version précédente supposait `[{ surah, ayahs: [{ ayah, start, end, segments }] }]`, un
> champ `audio`, et une basmala synthétique `ayah:0`. **Les trois sont faux pour `read=120`.**
>
> Schéma réel — **tableau plat** d'ayat, `ayah` de `1..N`, temps en **millisecondes** :
>
> ```json
> { "ayah": 1,
>   "polygon": "206.48,46.08 172.36,46.08 172.36,72.23 206.48,72.23",
>   "start_time": 6054, "end_time": 15993,
>   "x": "178.34", "y": "63.11",
>   "page": "https://www.mp3quran.net/api/quran_pages_svg/002.svg" }
> ```

**Test d'abord** — `tests/unit/timings.test.ts` :

```ts
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
    // read=118 renvoie 114 basmalas ayah:0 et fausse le survol sur 51 sourates.
    // L'ingest doit echouer bruyamment plutot que produire des timings silencieux faux.
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
```

**Implémentation** — `scripts/lib/timings.mjs` :

```js
export const PRECISION = Object.freeze({
  EXACT: "exact",
  PARTIAL: "partial",
  ESTIMATED: "estimated",
});

// L'API renvoie snake_case et des geometries absentes. On convertit une fois, ici, pour que
// le reste de l'ingest ne manipule que des noms stables.
export function normalizeTimings(payload) {
  if (!Array.isArray(payload)) {
    throw new TypeError("normalizeTimings: la reponse doit etre un tableau d'ayat");
  }
  return payload.map((raw) => {
    const startTime = raw.start_time;
    const endTime = raw.end_time;
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      throw new TypeError(`normalizeTimings: timings invalides pour l'ayah ${raw.ayah}`);
    }
    return {
      ayah: raw.ayah,
      startTime,
      endTime,
      polygon: raw.polygon || null,
      page: raw.page || null,
      x: raw.x,
      y: raw.y,
    };
  });
}

export function isMonotonic(ayatTimings) {
  for (const a of ayatTimings) {
    if (!Number.isFinite(a.startTime) || !Number.isFinite(a.endTime)) return false;
    if (a.startTime < 0 || a.endTime <= a.startTime) return false;
  }
  for (let i = 1; i < ayatTimings.length; i += 1) {
    if (ayatTimings[i].startTime < ayatTimings[i - 1].endTime) return false;
  }
  return true;
}

// Nombre d'ayat formant la sequence 1..n sans trou. Ce n'est PAS max(ayah) :
// un trou interne doit stopper le prefixe, et un surplus etranger ne l'allonge pas.
export function contiguousPrefix(numbers) {
  let n = 0;
  while (n < numbers.length && numbers[n] === n + 1) n += 1;
  return n;
}

export function classifyTimings({ ayahs, canonicalCount }) {
  if (!Array.isArray(ayahs)) throw new TypeError("classifyTimings: ayahs doit etre un tableau");
  if (!Number.isInteger(canonicalCount) || canonicalCount < 1) {
    throw new TypeError("classifyTimings: canonicalCount invalide");
  }

  // Garde-fou moshaf. `read=118` renvoie un ayah:0 (basmala synthetique) sur les 114
  // sourates et decale la numerotation sur 51 d'entre elles. C'est le seul mode de panne
  // qui produit un fichier valide mais faux : on le refuse plutot que de l'ingester.
  if (ayahs.some((a) => a.ayah === 0)) {
    throw new Error(
      "classifyTimings: basmala synthetique ayah:0 detectee — le moshaf du recitant " +
        "n'est pas Warsh (utiliser read=120, pas read=118)",
    );
  }

  // 26 ayat sur 6214 n'ont ni polygon ni page. Leurs timings sont valides : on les compte
  // pour piloter la degradation gracieuse, mais ils ne sont PAS des ayat manquants.
  const missingGeometry = ayahs
    .filter((a) => !a.polygon || !a.page)
    .map((a) => a.ayah)
    .sort((a, b) => a - b);

  if (ayahs.length === 0) {
    return {
      precision: PRECISION.ESTIMATED,
      coveredMax: 0,
      contiguous: false,
      missingTail: canonicalCount,
      missingGeometry,
    };
  }

  const numbers = ayahs.map((a) => a.ayah).sort((a, b) => a - b);
  const prefix = contiguousPrefix(numbers);
  const contiguous = prefix === numbers.length;

  // coveredMax ne peut pas depasser le canonique : les ayat au-dela sont numerotes
  // selon une autre riwaya et ne designent pas nos sourates.
  const coveredMax = Math.min(prefix, canonicalCount);

  let precision;
  if (contiguous && prefix === canonicalCount) precision = PRECISION.EXACT;
  else if (prefix < canonicalCount) precision = PRECISION.PARTIAL;
  else precision = PRECISION.ESTIMATED;

  return {
    precision,
    coveredMax,
    contiguous,
    missingTail: Math.max(0, canonicalCount - coveredMax),
    missingGeometry,
  };
}
```

**Test d'abord** — `tests/unit/estimate.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { estimateTail } from "../../scripts/lib/estimate.mjs";

const wordsOf = (map: Record<number, number>) => (ayah: number) => map[ayah] ?? 1;

describe("estimateTail", () => {
  it("remplit la queue manquante", () => {
    const rows = estimateTail({
      durationMs: 3000,
      coveredMax: 2,
      canonicalCount: 4,
      wordsOf: wordsOf({ 3: 1, 4: 1 }),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe(3);
    expect(rows[1][0]).toBe(4);
  });

  it("termine exactement sur la duree", () => {
    const rows = estimateTail({
      durationMs: 3000,
      coveredMax: 1,
      canonicalCount: 4,
      wordsOf: wordsOf({ 2: 1, 3: 2, 4: 5 }),
    });
    expect(rows.at(-1)![2]).toBe(3000);
  });

  it("reste strictement croissant et sans trou", () => {
    const rows = estimateTail({
      durationMs: 10000,
      coveredMax: 0,
      canonicalCount: 7,
      wordsOf: wordsOf({ 1: 3, 2: 1, 3: 9, 4: 2, 5: 4, 6: 1, 7: 6 }),
    });
    expect(rows[0][1]).toBe(0);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i][1]).toBe(rows[i - 1][2]);
      expect(rows[i][2]).toBeGreaterThan(rows[i][1]);
    }
  });

  it("renvoie un tableau vide si rien a estimer", () => {
    expect(
      estimateTail({ durationMs: 100, coveredMax: 4, canonicalCount: 4, wordsOf: () => 1 }),
    ).toEqual([]);
  });

  it("ne produit jamais d'intervalle vide avec un poids dominant", () => {
    const rows = estimateTail({
      durationMs: 10,
      coveredMax: 0,
      canonicalCount: 3,
      wordsOf: wordsOf({ 1: 1, 2: 1_000_000, 3: 1 }),
    });
    for (const [, start, end] of rows) expect(end).toBeGreaterThan(start);
    expect(rows.at(-1)![2]).toBe(10);
  });
});
```

**Implémentation** — `scripts/lib/estimate.mjs` :

```js
export function estimateTail({ durationMs, coveredMax, canonicalCount, wordsOf }) {
  const count = canonicalCount - coveredMax;
  if (count <= 0) return [];

  const weights = [];
  for (let i = 0; i < count; i += 1) {
    weights.push(Math.max(1, wordsOf(coveredMax + i + 1)));
  }
  const total = weights.reduce((a, b) => a + b, 0);

  const rows = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    // Math.max(1, ...) garantit une duree strictement positive meme quand un seul ayah
    // domine le ponderal ; Math.min(durationMs - 1, ...) empeche de depasser la fin.
    const end =
      i === count - 1
        ? durationMs
        : Math.min(
            durationMs - 1,
            cursor + Math.max(1, Math.round((weights[i] / total) * durationMs)),
          );
    rows.push([coveredMax + i + 1, cursor, end]);
    cursor = end;
  }
  return rows;
}
```

**Vérifier** : `npm test`

**Commit** : `feat(ingest): classification de precision et estimation de queue`

---

## Tâche 6 — Corroboration par `quran-meta`

**Fichiers** : `scripts/lib/corroborate.mjs`, `tests/unit/corroborate.test.ts`

La valeur de cette tâche est double : elle prouve que KFC et quran-meta sont d'accord sur la
pagination, et elle **verrouille le choix de l'accesseur**, puisque `getAyahMeta` est erroné.

**Test d'abord** — `tests/unit/corroborate.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import divergence from "../../scripts/fixtures/juz-divergence.json" with { type: "json" };
import { compareWithQuranMeta } from "../../scripts/lib/corroborate.mjs";

const warsh = {
  findPage: (s: number, a: number) => (s === 1 && a === 1 ? 1 : 1),
  findJuz: (s: number, a: number) => 1,
};

describe("compareWithQuranMeta", () => {
  it("detecte les ecarts de page", () => {
    const rows = Array.from({ length: 2 }, (_, i) => ({
      sura_no: 1,
      aya_no: i + 1,
      page: 1,
      jozz: 1,
    }));
    const r = compareWithQuranMeta(rows, warsh);
    expect(r.pageDiffs).toHaveLength(0);
  });

  it("exige une correspondance parfaite des pages", () => {
    const rows = [{ sura_no: 1, aya_no: 1, page: 2, jozz: 1 }];
    const r = compareWithQuranMeta(rows, warsh);
    expect(r.pageDiffs).toEqual([{ ayah: "1:1", kfc: 2, meta: 1 }]);
  });

  it("compare le juz et signale les divergences", () => {
    const rows = [{ sura_no: 2, aya_no: 141, page: 1, jozz: 2 }];
    const r = compareWithQuranMeta(rows, {
      findPage: () => 1,
      findJuz: () => 1,
    });
    expect(r.juzDiffs).toEqual([{ ayah: "2:141", kfc: 2, meta: 1 }]);
  });

  it("la fixture de divergence couvre 17 ayat et tous les couples distincts", () => {
    expect(divergence).toHaveLength(17);
    const pairs = new Set(divergence.map((d: { kfc: number; meta: number }) => `${d.kfc}->${d.meta}`));
    expect(pairs.has("6->5")).toBe(true);
    expect(pairs.has("6->7")).toBe(true);
    expect(pairs.has("7->8")).toBe(true);
    expect(pairs.has("9->8")).toBe(true);
  });
});
```

**Implémentation** — `scripts/lib/corroborate.mjs` :

```js
export function compareWithQuranMeta(rows, warsh) {
  const pageDiffs = [];
  const juzDiffs = [];
  for (const r of rows) {
    const key = `${r.sura_no}:${r.aya_no}`;
    const page = warsh.findPage(r.sura_no, r.aya_no);
    if (page !== r.page) pageDiffs.push({ ayah: key, kfc: r.page, meta: page });
    const juz = warsh.findJuz(r.sura_no, r.aya_no);
    if (juz !== r.jozz) juzDiffs.push({ ayah: key, kfc: r.jozz, meta: juz });
  }
  return { pageDiffs, juzDiffs };
}

export function formatJuzDiffs(diffs) {
  return diffs
    .map((d) => `${d.ayah}  KFC=${d.kfc}  meta=${d.meta}`)
    .sort()
    .join("\n");
}
```

**Vérifier** : `npm test`

**Commit** : `feat(ingest): corroboration KFC / quran-meta via findPage et findJuz`

---

## Tâche 7 — Types TypeScript, écriture atomique, orchestrateur

**Fichiers** : `src/types.ts`, `scripts/lib/io.mjs`, `scripts/ingest.mjs`,
`tests/unit/io.test.ts`

**Test d'abord** — `tests/unit/io.test.ts` :

```ts
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJsonAtomic } from "../../scripts/lib/io.mjs";

describe("writeJsonAtomic", () => {
  it("ecrit un JSON lisible et ne laisse pas de fichier temporaire", () => {
    const dir = mkdtempSync(join(tmpdir(), "coran-"));
    const path = join(dir, "out.json");
    writeJsonAtomic(path, { a: 1 });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ a: 1 });
    expect(readdirSync(dir)).toEqual(["out.json"]);
  });

  it("n'ecrit rien si la serialisation echoue", () => {
    const dir = mkdtempSync(join(tmpdir(), "coran-"));
    const path = join(dir, "out.json");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => writeJsonAtomic(path, cyclic)).toThrow();
    expect(readdirSync(dir)).toEqual([]);
  });
});
```

**Implémentation** — `scripts/lib/io.mjs` :

```js
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function writeJsonAtomic(path, value) {
  const payload = JSON.stringify(value);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, payload, "utf8");
    renameSync(tmp, path);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
}
```

**Types** — `src/types.ts` :

```ts
export type AyahRow = readonly [juz: number, page: number, text: string];

export interface Surah {
  n: number;
  en: string;
  ar: string;
  a: AyahRow[];
}

export interface QuranData {
  meta: {
    riwaya: "warsh";
    source: string;
    ayahCount: number;
    surahCount: number;
    pageCount: number;
    juzCount: number;
  };
  surahs: Surah[];
}

export type Precision = "exact" | "partial" | "estimated";

export type TimingRow = readonly [ayah: number, startMs: number, endMs: number];

export interface SurahTimings {
  surah: number;
  reciter: number;
  audioUrl: string;
  precision: Precision;
  durationMs: number;
  ayat: TimingRow[];
}

export interface Reciter {
  id: number;
  rewayaId: number;
  label: string;
  labelFr: string;
  priority: number;
}
```

**Implémentation** — `scripts/ingest.mjs` (squelette exécutable) :

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as QM from "quran-meta/warsh";
import { KFGQPC, RECITERS, TIMINGS_ENDPOINT, AUDIO_BASE, selectReciter } from "./lib/manifest.mjs";
import { md5Hex, sha256File } from "./lib/verify.mjs";
import { IngestError, parseKfgqpc } from "./lib/parse-kfgqpc.mjs";
import { compareWithQuranMeta } from "./lib/corroborate.mjs";
import { classifyTimings, normalizeTimings } from "./lib/timings.mjs";
import { estimateTail } from "./lib/estimate.mjs";
import { writeJsonAtomic } from "./lib/io.mjs";
import surahCounts from "./fixtures/surah-counts.json" with { type: "json" };
import divergence from "./fixtures/juz-divergence.json" with { type: "json" };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache");
const DATA = join(ROOT, "src", "data");
const warsh = QM.default ?? QM;

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const OFFLINE = process.argv.includes("--offline");

function log(step, message) {
  process.stdout.write(`[ingest:${step}] ${message}\n`);
}

async function resolveZip() {
  const local = arg("zip");
  if (local) return resolve(local);
  const cached = join(CACHE, "kfgqpc_warsh_v30.zip");
  if (existsSync(cached)) {
    log("zip", `cache ${cached}`);
    return cached;
  }
  if (OFFLINE) throw new IngestError("--offline mais aucun ZIP en cache");
  const url = arg("zip-url");
  if (!url) {
    throw new IngestError(
      "fournir --zip=<chemin local> ou --zip-url=<url directe du ZIP sur qurancomplex.gov.sa>",
    );
  }
  log("zip", `telechargement ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new IngestError(`telechargement echoue: HTTP ${res.status}`);
  mkdirSync(CACHE, { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(cached, buf);
  return cached;
}

async function extractZip(zipPath) {
  const out = join(CACHE, "extracted");
  if (existsSync(join(out, KFGQPC.json.path))) {
    log("zip", "deja extrait");
    return out;
  }
  mkdirSync(out, { recursive: true });
  log("zip", "extraction");
  const ps = `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${out}' -Force`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
  return out;
}

const TIMINGS_CACHE = join(CACHE, "timings");

// --offline doit etre un vrai mode : jamais de reseau, lecture du cache obligatoire.
async function fetchJsonCached(url, cachePath) {
  if (existsSync(cachePath)) {
    log("timings", `cache ${cachePath}`);
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  if (OFFLINE) {
    throw new IngestError(`--offline mais aucune donnee en cache: ${cachePath}`);
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new IngestError(`HTTP ${res.status} sur ${url}`);
      const payload = await res.json();
      mkdirSync(dirname(cachePath), { recursive: true });
      writeJsonAtomic(cachePath, payload);
      return payload;
    } catch (error) {
      lastError = error;
      log("timings", `tentative ${attempt}/3 echouee: ${error.message}`);
    }
  }
  throw new IngestError(`telechargement timings impossible: ${lastError.message}`);
}

async function main() {
  const zipPath = await resolveZip();
  const digest = await sha256File(zipPath);
  if (digest !== KFGQPC.zipSha256) {
    throw new IngestError(
      `SHA-256 du ZIP inattendu.\n  attendu ${KFGQPC.zipSha256}\n  obtenu  ${digest}`,
    );
  }
  log("zip", "SHA-256 conforme");

  const root = await extractZip(zipPath);
  const jsonPath = join(root, KFGQPC.json.path);
  const ttfPath = join(root, KFGQPC.ttf.path);
  for (const [p, expected] of [
    [jsonPath, KFGQPC.json.md5],
    [ttfPath, KFGQPC.ttf.md5],
  ]) {
    if (!existsSync(p)) throw new IngestError(`fichier absent dans le ZIP: ${p}`);
    const got = md5Hex(readFileSync(p));
    if (got !== expected) throw new IngestError(`MD5 inattendu pour ${p}: ${got}`);
  }
  log("zip", "JSON et TTF conformes");

  const rows = JSON.parse(readFileSync(jsonPath, "utf8"));
  const parsed = parseKfgqpc(rows);
  log("texte", `${parsed.meta.ayahCount} ayat, ${parsed.meta.surahCount} sourates`);

  for (const surah of parsed.surahs) {
    const expected = surahCounts[String(surah.n)];
    if (surah.a.length !== expected) {
      throw new IngestError(
        `sourate ${surah.n}: ${surah.a.length} ayat, ${expected} attendus d'apres la fixture`,
      );
    }
  }
  log("texte", "comptes de sourate conformes a la fixture");

  const cmp = compareWithQuranMeta(rows, warsh);
  if (cmp.pageDiffs.length > 0) {
    throw new IngestError(
      `${cmp.pageDiffs.length} ecarts de page avec quran-meta (attendu 0). Premier: ${cmp.pageDiffs[0].ayah}`,
    );
  }
  log("corroboration", "0 ecart de page avec quran-meta");

  const actual = cmp.juzDiffs
    .map((d) => ({ ayah: d.ayah, kfc: d.kfc, meta: d.meta }))
    .sort((a, b) => a.ayah.localeCompare(b.ayah, "en", { numeric: true }));
  const expected = [...divergence].sort((a, b) => a.ayah.localeCompare(b.ayah, "en", { numeric: true }));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new IngestError(
      `les ecarts de juz ont change.\n  attendu ${expected.length}\n  obtenu  ${actual.length}`,
    );
  }
  log("corroboration", `${actual.length} ecarts de juz, identiques a la fixture`);

  const reciter = selectReciter(arg("reciter"));
  const timingsDir = join(DATA, "timings", String(reciter.id));
  const audioBase = arg("audio-base") ?? AUDIO_BASE;
  const precisionCounts = { exact: 0, partial: 0, estimated: 0 };
  const surahReports = [];
  const audioUrls = {};

  for (const surah of parsed.surahs) {
    const url = TIMINGS_ENDPOINT.replace("{surah}", String(surah.n)).replace(
      "{reciter}",
      String(reciter.id),
    );
    const payload = await fetchJsonCached(
      url,
      join(TIMINGS_CACHE, String(reciter.id), `${surah.n}.json`),
    );
    // La reponse est un TABLEAU PLAT d'ayat (pas [{surah, ayahs}]). Le champ `audio`
    // n'existe pas : l'URL se reconstruit depuis le serveur du moshaf declare au manifeste.
    const ayat = normalizeTimings(payload);
    const info = classifyTimings({ ayahs: ayat, canonicalCount: surah.a.length });

    // `read=120` est le moshaf Warsh ; l'API ne valide pas la correspondance texte/timing,
    // c'est donc l'invariant qu'on tient, pas l'API.
    const audioUrl = `${audioBase}/${String(surah.n).padStart(3, "0")}.mp3`;
    audioUrls[String(surah.n)] = audioUrl;

    // On ne conserve que le prefixe contigu 1..k renvoye par l'API. Un trou interne
    // ou une numerotation etrangere a la riwaya ne doivent surtout pas produire de
    // doublon ni de desordre quand la queue estimee est concatenee.
    const inRange = ayat
      .filter((a) => a.ayah >= 1 && a.ayah <= surah.a.length)
      .sort((a, b) => a.ayah - b.ayah);

    let rowsOut = inRange.slice(0, info.coveredMax).map((a) => [a.ayah, a.startTime, a.endTime]);

    const durationMs = ayat.length > 0 ? Math.max(...ayat.map((a) => a.endTime)) : 0;

    if (info.missingTail > 0 && durationMs === 0) {
      throw new IngestError(
        `sourate ${surah.n}: ${info.missingTail} ayat sans timing et aucune duree connue, ` +
          `impossible d'estimer. Verifier la couverture de l'API pour cette sourate.`,
      );
    }
    if (info.missingTail > 0) {
      const tail = estimateTail({
        durationMs,
        coveredMax: info.coveredMax,
        canonicalCount: surah.a.length,
        wordsOf: (n) => surah.a[n - 1]?.[2]?.trim().split(/\s+/).length ?? 1,
      });
      rowsOut = rowsOut.concat(tail);
    }
    if (rowsOut.length !== surah.a.length) {
      throw new IngestError(
        `sourate ${surah.n}: ${rowsOut.length} lignes de timing, ${surah.a.length} attendues`,
      );
    }

    writeJsonAtomic(join(timingsDir, `${surah.n}.json`), {
      surah: surah.n,
      reciter: reciter.id,
      audioUrl,
      precision: info.precision,
      durationMs,
      ayat: rowsOut,
      // Geometrie conservee telle quelle : `null` pour les 26 ayat sans polygone, que
      // l'UI traitera en degrade gracieux plutot que de refusesur d'afficher l'ayah.
      geometry: Object.fromEntries(
        inRange.map((a) => [a.ayah, { polygon: a.polygon, page: a.page, x: a.x, y: a.y }]),
      ),
    });

    precisionCounts[info.precision] += 1;
    surahReports.push({
      surah: surah.n,
      precision: info.precision,
      coveredMax: info.coveredMax,
      canonical: surah.a.length,
      missingGeometry: info.missingGeometry,
    });
  }
  log("timings", JSON.stringify(precisionCounts));

  const geometryGaps = surahReports.flatMap((r) =>
    r.missingGeometry.map((a) => ({ surah: r.surah, ayah: a })),
  );
  if (geometryGaps.length > 0) {
    log("timings", `${geometryGaps.length} ayat sans polygone (timings conserves)`);
  }

  writeJsonAtomic(join(DATA, "quran-warsh.json"), parsed);

  writeJsonAtomic(join(DATA, "meta.json"), {
    riwaya: "warsh",
    source: {
      id: KFGQPC.id,
      publisher: KFGQPC.publisher,
      portalUrl: KFGQPC.portalUrl,
      license: KFGQPC.license,
      licenseNote: KFGQPC.licenseNote,
      zipSha256: KFGQPC.zipSha256,
      jsonMd5: KFGQPC.json.md5,
      ttfMd5: KFGQPC.ttf.md5,
    },
    counts: {
      ayahs: parsed.meta.ayahCount,
      surahs: parsed.meta.surahCount,
      pages: parsed.meta.pageCount,
      juz: parsed.meta.juzCount,
    },
    reciters: RECITERS,
    surahs: parsed.surahs.map((s) => ({
      n: s.n,
      en: s.en,
      ar: s.ar,
      ayahs: s.a.length,
      juzFrom: s.a[0][0],
      juzTo: s.a[s.a.length - 1][0],
      pageFrom: s.a[0][1],
      pageTo: s.a[s.a.length - 1][1],
    })),
  });

  // Pas d'horodatage ici : ce rapport est versionne et l'ingest doit rester idempotent
  // byte-identique. La date d'execution apparait uniquement dans les logs.
  writeJsonAtomic(join(DATA, "ingest-report.json"), {
    node: process.version,
    counts: parsed.meta,
    corroboration: {
      pages: { diffs: cmp.pageDiffs.length },
      juz: { diffs: cmp.juzDiffs, total: cmp.juzDiffs.length },
    },
    timings: { reciter: reciter.id, audioBase, precisionCounts, surahs: surahReports },
    audioUrls,
  });

  const fontDir = join(ROOT, "src", "assets", "fonts");
  mkdirSync(fontDir, { recursive: true });
  copyFileSync(ttfPath, join(fontDir, "kfgqpc_warsh_v30.ttf"));
  log("police", "kfgqpc_warsh_v30.ttf copiee");

  log("fin", "ingest reussi");
}

main().catch((error) => {
  process.stderr.write(`\n[ingest:ECHEC] ${error.message}\n`);
  process.exitCode = 1;
});
```

**Vérifier** : `npm test`, puis l'ingest réel :

```powershell
npm run ingest -- --zip="C:\chemin\vers\kfgqpc_warsh_v30.zip"
```

Le rapport doit afficher `0 ecart de page` et `17 ecarts de juz`.

**Commit** : `feat(ingest): orchestrateur, donnees generees et rapport`

---

## Tâche 8 — Police embarquée

**Fichiers** : `src/styles/fonts.css`, `tests/unit/font.test.ts`

**Test d'abord** — `tests/unit/font.test.ts` :

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KFGQPC } from "../../scripts/lib/manifest.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONT = join(ROOT, "src", "assets", "fonts", "kfgqpc_warsh_v30.ttf");

describe("police KFGQPC", () => {
  it("est presente avec la bonne empreinte", () => {
    const buf = readFileSync(FONT);
    expect(createHash("md5").update(buf).digest("hex")).toBe(KFGQPC.ttf.md5);
  });

  it("a un en-tête TrueType valide", () => {
    const buf = readFileSync(FONT);
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x01, 0x00, 0x00]));
    expect(buf.length).toBeGreaterThan(200000);
  });
});
```

**Implémentation** — `src/styles/fonts.css` :

```css
@font-face {
  font-family: "KFGQPC Warsh";
  src: url("../assets/fonts/kfgqpc_warsh_v30.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

.ayah-text {
  font-family: "KFGQPC Warsh", "Traditional Arabic", "Amiri", serif;
  font-size: 1.75rem;
  line-height: 2.1;
}
```

Importer dans `src/main.tsx` : `import "./styles/fonts.css";`

**Vérifier** : `npm test`

**Commit** : `feat(ui): police KFGQPC Warsh embarquee`

---

## Tâche 9 — Recherche binaire dans les timings

**Fichiers** : `src/sync/timing-index.ts`, `tests/unit/timing-index.test.ts`

**Test d'abord** — `tests/unit/timing-index.test.ts` :

```ts
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
```

**Implémentation** — `src/sync/timing-index.ts` :

```ts
import type { TimingRow } from "../types";

/**
 * Renvoie le numero d'ayah courant, ou null avant le premier ayah.
 * Un trou entre deux ayahs conserve l'ayah courant plutot que de perdre le surlignage.
 */
export function findAyahAt(rows: readonly TimingRow[], ms: number): number | null {
  if (rows.length === 0) return null;
  if (ms < rows[0][1]) return null;

  let lo = 0;
  let hi = rows.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][1] <= ms) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return rows[best][0];
}
```

**Vérifier** : `npm test`

**Commit** : `feat(sync): recherche dichotomique de l'ayah courant`

---

## Tâche 10 — Hook de synchronisation

**Fichiers** : `src/sync/use-sync-engine.ts`, `tests/unit/use-sync-engine.test.ts`

**Test d'abord** — `tests/unit/use-sync-engine.test.ts` :

```ts
/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncEngine } from "../../src/sync/use-sync-engine";

const rows = [
  [1, 0, 1000],
  [2, 1000, 2000],
  [3, 2000, 3000],
] as const;

describe("useSyncEngine", () => {
  beforeEach(() => {
    // rAF are stubbed and the clock is faked: without both, the loop is not drivable.
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 16) as unknown as number,
    );
    vi.stubGlobal("cancelAnimationFrame", (h: number) => clearTimeout(h));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rapporte le premier ayah des la premiere image", () => {
    const audio = { currentTime: 0 } as HTMLAudioElement;
    const seen: (number | null)[] = [];
    renderHook(() => useSyncEngine(audio, rows, (a) => seen.push(a)));

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(seen).toEqual([1]);
  });

  it("signale le changement d'ayah quand currentTime avance", () => {
    const audio = { currentTime: 0 } as HTMLAudioElement;
    const seen: (number | null)[] = [];
    renderHook(() => useSyncEngine(audio, rows, (a) => seen.push(a)));

    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      audio.currentTime = 1.5;
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(seen).toEqual([1, 2]);
  });

  it("ne rappelle pas le callback si l'ayah n'a pas change", () => {
    const audio = { currentTime: 0.2 } as HTMLAudioElement;
    const onAyah = vi.fn();
    renderHook(() => useSyncEngine(audio, rows, onAyah));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 1er ayah signale une fois, puis plus rien malgre plusieurs images
    expect(onAyah).toHaveBeenCalledTimes(1);
    expect(onAyah).toHaveBeenCalledWith(1);
  });

  it("reste muet avant le premier ayah", () => {
    const audio = { currentTime: 0 } as HTMLAudioElement;
    const onAyah = vi.fn();
    const late = [
      [1, 500, 1000],
      [2, 1000, 2000],
    ] as const;
    renderHook(() => useSyncEngine(audio, late, onAyah));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onAyah).not.toHaveBeenCalled();
  });
});
```

**Implémentation** — `src/sync/use-sync-engine.ts` :

```ts
import { useEffect, useRef } from "react";
import type { TimingRow } from "../types";
import { findAyahAt } from "./timing-index";

export function useSyncEngine(
  audio: HTMLAudioElement | null,
  rows: readonly TimingRow[],
  onAyah: (ayah: number | null) => void,
): void {
  const last = useRef<number | null>(null);
  const callback = useRef(onAyah);
  callback.current = onAyah;

  useEffect(() => {
    if (!audio) return;
    let frame = 0;
    const tick = () => {
      const current = findAyahAt(rows, audio.currentTime * 1000);
      if (current !== last.current) {
        last.current = current;
        callback.current(current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      last.current = null;
    };
  }, [audio, rows]);
}
```

**Vérifier** : `npm test`

**Commit** : `feat(sync): moteur de synchronisation audio / surlignage`

---

## Tâche 11 — État de session et composants de lecture

**Fichiers** : `src/state/session.ts`, `src/components/AyahItem.tsx`,
`src/components/AyahList.tsx`, `src/components/SurahPicker.tsx`,
`tests/unit/components.test.tsx`

**Test d'abord** — `tests/unit/components.test.tsx` :

```tsx
/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AyahList } from "../../src/components/AyahList";
import { SurahPicker } from "../../src/components/SurahPicker";

const surah = {
  n: 112,
  en: "Al-Ikhlas",
  ar: "الإخلاص",
  a: [
    [30, 604, "قُلْ هُوَ ٱللَّهُ أَحَدٌ"],
    [30, 604, "ٱللَّهُ ٱلصَّمَدُ"],
    [30, 604, "لَمْ يَلِدْ وَلَمْ يُولَدْ"],
    [30, 604, "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ"],
  ] as [number, number, string][],
};

describe("AyahList", () => {
  it("affiche tous les ayahs en RTL", () => {
    render(<AyahList surah={surah} activeAyah={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const text = screen.getByTestId("ayah-1-text");
    expect(text).toHaveAttribute("dir", "rtl");
    expect(text).toHaveAttribute("lang", "ar");
  });

  it("marque l'ayah actif", () => {
    render(<AyahList surah={surah} activeAyah={2} onSelect={() => {}} />);
    expect(screen.getByTestId("ayah-2")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("ayah-1")).toHaveAttribute("data-active", "false");
  });

  it("remonte la selection", async () => {
    const seen: number[] = [];
    render(<AyahList surah={surah} activeAyah={null} onSelect={(n) => seen.push(n)} />);
    await userEvent.click(screen.getByTestId("ayah-3"));
    expect(seen).toEqual([3]);
  });

  it("conserve les codepoints etendus du texte", () => {
    render(<AyahList surah={surah} activeAyah={null} onSelect={() => {}} />);
    expect(screen.getByTestId("ayah-4-text").textContent).toContain("\u08F0");
  });
});

describe("SurahPicker", () => {
  it("liste les 114 sourates", () => {
    render(<SurahPicker surahs={Array.from({ length: 114 }, (_, i) => ({ n: i + 1, en: `S${i + 1}`, ar: "", a: [] }))} value={1} onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(114);
  });
});
```

**Implémentation** — `src/state/session.ts` :

```ts
import { useState } from "react";

export interface SessionState {
  surah: number;
  ayah: number | null;
  reciter: number;
  playing: boolean;
}

export function useSession(initial: Partial<SessionState> = {}) {
  const [state, setState] = useState<SessionState>({
    surah: 1,
    ayah: null,
    reciter: 120,
    playing: false,
    ...initial,
  });
  return {
    state,
    setSurah: (surah: number) => setState((s) => ({ ...s, surah, ayah: null })),
    setAyah: (ayah: number | null) => setState((s) => ({ ...s, ayah })),
    setReciter: (reciter: number) => setState((s) => ({ ...s, reciter })),
    setPlaying: (playing: boolean) => setState((s) => ({ ...s, playing })),
  };
}
```

**Implémentation** — `src/components/AyahItem.tsx` :

```tsx
import type { AyahRow } from "../types";

interface Props {
  ayah: number;
  text: string;
  juz: number;
  page: number;
  active: boolean;
  onSelect: (ayah: number) => void;
}

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export function AyahItem({ ayah, text, juz, page, active, onSelect }: Props) {
  return (
    <li
      className="ayah"
      data-active={active}
      data-testid={`ayah-${ayah}`}
      onClick={() => onSelect(ayah)}
    >
      <span className="ayah-marker" aria-hidden="true">
        {toArabicDigits(ayah)}
      </span>
      <span className="ayah-text" lang="ar" dir="rtl" data-testid={`ayah-${ayah}-text`}>
        {text}
      </span>
      <span className="ayah-ref">
        {juz}:{page}
      </span>
    </li>
  );
}

export type { AyahRow };
```

**Implémentation** — `src/components/AyahList.tsx` :

```tsx
import type { Surah } from "../types";
import { AyahItem } from "./AyahItem";

interface Props {
  surah: Surah;
  activeAyah: number | null;
  onSelect: (ayah: number) => void;
}

export function AyahList({ surah, activeAyah, onSelect }: Props) {
  return (
    <ol className="ayah-list" aria-label={`Sourate ${surah.en}`}>
      {surah.a.map(([juz, page, text], i) => (
        <AyahItem
          key={surah.n + ":" + (i + 1)}
          ayah={i + 1}
          text={text}
          juz={juz}
          page={page}
          active={activeAyah === i + 1}
          onSelect={onSelect}
        />
      ))}
    </ol>
  );
}
```

**Implémentation** — `src/components/SurahPicker.tsx` :

```tsx
interface Props {
  surahs: { n: number; en: string; ar: string }[];
  value: number;
  onChange: (surah: number) => void;
}

export function SurahPicker({ surahs, value, onChange }: Props) {
  return (
    <select
      aria-label="Sourate"
      value={value}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
    >
      {surahs.map((s) => (
        <option key={s.n} value={s.n}>
          {s.n}. {s.en}
        </option>
      ))}
    </select>
  );
}
```

**Vérifier** : `npm test`

**Commit** : `feat(ui): liste d'ayat RTL, surlignage et selecteur de sourate`

---

## Tâche 12 — Lecteur audio

**Fichiers** : `src/components/PlayerBar.tsx`, `src/App.tsx`, `tests/unit/player-bar.test.tsx`

**Test d'abord** — `tests/unit/player-bar.test.tsx` :

```tsx
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerBar } from "../../src/components/PlayerBar";

const timings = {
  surah: 112,
  reciter: 120,
  audioUrl: "https://example.test/112.mp3",
  precision: "exact",
  durationMs: 40_000,
  ayat: [
    [1, 0, 10_000],
    [2, 10_000, 20_000],
    [3, 20_000, 30_000],
    [4, 30_000, 40_000],
  ] as [number, number, number][],
};

const base = {
  timings,
  audioUrl: "https://example.test/112.mp3",
  reciters: [],
  reciter: 120,
  onReciter: () => {},
  onAyah: () => {},
};

describe("PlayerBar", () => {
  it("affiche la duree totale", () => {
    render(<PlayerBar {...base} />);
    expect(screen.getByTestId("player-duration")).toHaveTextContent("0:40");
  });

  it("bascule lecture / pause", async () => {
    const user = userEvent.setup();
    const play = vi.fn().mockResolvedValue(undefined);
    render(<PlayerBar {...base} play={play} />);
    await user.click(screen.getByRole("button", { name: /lire/i }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  // Un `input[type=range]` n'est pas un champ texte : `userEvent.type` n'y fait
  // rien. On passe par un evenement `change`, et l'interface expose des SECONDES
  // alors que `seek` recoit des MILLISECONDES. L'assertion doit donc porter sur
  // 15000, pas 15.
  it("convertit la position en secondes vers des millisecondes", () => {
    const seek = vi.fn();
    render(<PlayerBar {...base} seek={seek} />);
    fireEvent.change(screen.getByTestId("player-seek"), { target: { value: "15" } });
    expect(seek).toHaveBeenCalledWith(15_000);
  });

  it("remet la position a zero quand la sourate change", () => {
    const { rerender } = render(<PlayerBar {...base} />);
    fireEvent.change(screen.getByTestId("player-seek"), { target: { value: "15" } });
    expect(screen.getByTestId("player-position")).toHaveTextContent("0:15");

    rerender(<PlayerBar {...base} audioUrl="https://example.test/113.mp3" />);
    expect(screen.getByTestId("player-position")).toHaveTextContent("0:00");
  });

  it("signale une precision non exacte", () => {
    render(
      <PlayerBar
        {...base}
        timings={{ ...timings, precision: "estimated" }}
      />,
    );
    expect(screen.getByText(/estim/i)).toBeTruthy();
  });

  // La sourate 2 pese ~95 Mo. Toute degrade vers `fetch` + `blob:` tuerait l'onglet et
  // le mobile. Le streaming par requetes `Range` est assure nativement par <audio src> ;
  // ce test verrouille le choix, il n'a pas a simuler le navigateur.
  it("branche l'audio en streaming, sans telechargement ni blob", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<PlayerBar {...base} />);
    const audio = screen.getByTestId("player-audio") as HTMLAudioElement;
    expect(audio.getAttribute("src")).toBe("https://example.test/112.mp3");
    expect(audio.getAttribute("preload")).toBe("metadata");
    expect(audio.getAttribute("src") ?? "").not.toMatch(/^blob:/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

**Implémentation** — `src/components/PlayerBar.tsx` :

```tsx
import { useEffect, useState } from "react";
import type { Reciter, SurahTimings, TimingRow } from "../types";
import { useSyncEngine } from "../sync/use-sync-engine";

interface Props {
  timings: SurahTimings | null;
  audioUrl: string;
  reciters: Reciter[];
  reciter: number;
  onReciter: (id: number) => void;
  onAyah: (ayah: number | null) => void;
  play?: () => Promise<void>;
  pause?: () => void;
  seek?: (ms: number) => void;
}

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

// Reference stable : `useSyncEngine` liste `rows` dans ses dependances, donc un
// `[]` recree a chaque rendu demonterait la boucle rAF et reseterait `last`,
// ce qui re-declenche `onAyah` en boucle.
const NO_ROWS: readonly TimingRow[] = [];

export function PlayerBar(props: Props) {
  const { timings, audioUrl, reciters, reciter, onReciter, onAyah } = props;
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);

  useSyncEngine(audioEl, timings?.ayat ?? NO_ROWS, onAyah);

  // Changer de sourate doit remettre le curseur a zero, sinon on affiche la
  // position d'un audio precedent sur le nouvel audio.
  useEffect(() => {
    setPosition(0);
    setPlaying(false);
  }, [audioUrl]);

  useEffect(() => {
    const el = audioEl;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime * 1000);
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [audioEl]);

  const doPlay = async () => {
    if (props.play) await props.play();
    else if (audioEl) await audioEl.play();
    setPlaying(true);
  };
  const doPause = () => {
    if (props.pause) props.pause();
    else audioEl?.pause();
    setPlaying(false);
  };
  // Le range expose des SECONDES (step=1) ; `seek` recoit des MILLISECONDES.
  const doSeek = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    if (props.seek) props.seek(ms);
    else if (audioEl) audioEl.currentTime = seconds;
    setPosition(ms);
  };

  return (
    <div className="player">
      {/* `ref` en callback : c'est la seule facon d'obtenir un element audio
          stable, un `useRef` n'est pas reactive au premier rendu. */}
      <audio ref={setAudioEl} src={audioUrl} preload="metadata" data-testid="player-audio" />
      {reciters.length > 1 && (
        <select aria-label="Récitant" value={reciter} onChange={(e) => onReciter(Number(e.currentTarget.value))}>
          {reciters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.labelFr}
            </option>
          ))}
        </select>
      )}
      <button type="button" onClick={playing ? doPause : doPlay} aria-label={playing ? "Pause" : "Lire"}>
        {playing ? "❚❚" : "▶"}
      </button>
      <input
        data-testid="player-seek"
        type="range"
        min={0}
        max={(timings?.durationMs ?? 0) / 1000}
        step={1}
        value={Math.floor(position / 1000)}
        onChange={(e) => doSeek(Number(e.currentTarget.value))}
        aria-label="Position"
      />
      <span data-testid="player-position">{mmss(position)}</span>
      <span aria-hidden="true">/</span>
      <span data-testid="player-duration">{mmss(timings?.durationMs ?? 0)}</span>
      {timings && timings.precision !== "exact" && (
        <span className="badge">timings estimés</span>
      )}
    </div>
  );
}
```

**Implémentation** — `src/App.tsx` : assemble le tout.

```tsx
import { useEffect, useState } from "react";
import "./styles/fonts.css";
import quran from "./data/quran-warsh.json";
import meta from "./data/meta.json";
import { AyahList } from "./components/AyahList";
import { PlayerBar } from "./components/PlayerBar";
import { SurahPicker } from "./components/SurahPicker";
import { useSession } from "./state/session";
import type { QuranData, Reciter, SurahTimings } from "./types";

// Les 114 fichiers de timings doivent etre decouverts a la compilation. Un
// `import()` dont le chemin est construit dynamiquement n'est pas analysable par
// Vite : en production il echoue silencieusement ou leve une erreur de resolution.
// `import.meta.glob` genere les 114Chunk(s) a la compilation.
const timingModules = import.meta.glob<{ default: SurahTimings }>(
  "./data/timings/*/*.json",
);

export function App() {
  const data = quran as unknown as QuranData;
  const metaData = meta as unknown as { reciters: Reciter[] };
  const { state, setSurah, setAyah, setReciter } = useSession();
  const surah = data.surahs[state.surah - 1];
  const [timings, setTimings] = useState<SurahTimings | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = timingModules[`./data/timings/${state.reciter}/${state.surah}.json`];
    if (!load) {
      setTimings(null);
      return;
    }
    void load().then((mod) => {
      if (!cancelled) setTimings(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [state.surah, state.reciter]);

  return (
    <>
      <header>
        <h1>Coran — Warsh</h1>
        <SurahPicker surahs={data.surahs} value={state.surah} onChange={setSurah} />
      </header>
      <main>
        <h2 dir="rtl" lang="ar">
          {surah.ar}
        </h2>
        <AyahList surah={surah} activeAyah={state.ayah} onSelect={setAyah} />
      </main>
      <PlayerBar
        timings={timings}
        audioUrl={timings?.audioUrl ?? ""}
        reciters={metaData.reciters}
        reciter={state.reciter}
        onReciter={setReciter}
        // `onAyah` emet `null` quand aucun ayah n'est actif ; `setAyah` attend un
        // nombre, on ne doit donc pas le transmettre tel quel.
        onAyah={(a) => {
          if (a !== null) setAyah(a);
        }}
      />
    </>
  );
}
```

> **Streaming, pas de téléchargement** : `PlayerBar` ne reçoit jamais le fichier. La sourate 2
> fait ~95 Mo ; la charger en mémoire casserait l'onglet et le mobile. `<audio>` est branché
> directement sur `audioUrl` et le navigateur gère les requêtes `Range` lui-même : c'est le
> mécanisme natif du streaming, il n'y a donc **rien à implémenter côté fetch**. Ce qu'il faut
> tester, c'est qu'on ne dégrade pas vers un `fetch` + `blob:`.

L'URL audio vient de `timings.audioUrl`, écrit par l'ingest en **reconstruisant** l'URL depuis
le serveur du moshaf (tâche 0) — la réponse timings **n'a aucun champ `audio`**. Aucune
constante d'hôte n'est codée en dur dans l'application : si l'URL change, seul
`scripts/ingest.mjs` est à corriger, puis `npm run ingest`.

**Vérifier** : `npm test`, `npm run typecheck`, `npm run build`, puis `npm run dev` et contrôle
manuel sourates 1, 36, 112.

**Commit** : `feat(ui): lecteur audio avec surlignage synchronise`

---

## Tâche 13 — Tests de bout en bout

**Fichiers** : `playwright.config.ts`, `tests/e2e/wav.ts`, `tests/e2e/reader.spec.ts`

L'audio est réseau seul, donc on **intercepte** la requête et on sert un WAV silencieux de la
bonne durée. Aucun binaire n'est commité, aucun test ne dépend du réseau.

**`tests/e2e/wav.ts`** :

```ts
/** Genere un WAV PCM 8 bits mono silencieux de la duree demandee. */
export function silentWav(durationMs: number): Buffer {
  const sampleRate = 8000;
  const samples = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const dataSize = samples;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  buf.fill(128, 44);
  return buf;
}
```

**`playwright.config.ts`** :

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4173", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
```

**`tests/e2e/reader.spec.ts`** :

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { silentWav } from "./wav";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const timings = (surah: number) =>
    JSON.parse(readFileSync(join(ROOT, "src", "data", "timings", "120", `${surah}.json`), "utf8")) as {
    durationMs: number;
    precision: string;
    ayat: [number, number, number][];
  };

// Le motif doit survivre au changement d'hote et de repertoire de la tache 0
// (`Rewayat-Warsh-A-n-Nafi/112.mp3` ne passe PAS sous `**/husr/*.mp3`).
async function stubAudio(page: import("@playwright/test").Page, surah: number) {
  const wav = silentWav(timings(surah).durationMs);
  await page.route("**/*.mp3", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: wav }),
  );
}

/**
 * `fill()` est invalide sur `input[type=range]`. On ecrase la valeur via le
 * setter natif, sinon React ignore l'evenement (il compare a sa valeur
 * memorisee), puis on dispatche `input` et `change`.
 */
async function seekTo(page: import("@playwright/test").Page, seconds: number) {
  await page.getByTestId("player-seek").evaluate((el, s) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, String(s));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, seconds);
}

async function waitForMetadata(page: import("@playwright/test").Page) {
  await page.getByTestId("player-audio").evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const audio = el as HTMLAudioElement;
        if (audio.readyState >= 1) return resolve();
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => resolve(), { once: true });
      }),
  );
}

test.describe("lecteur", () => {
  test("affiche la sourate 112 en RTL avec ses 4 ayahs", async ({ page }) => {
    await stubAudio(page, 112);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");
    await expect(page.locator(".ayah")).toHaveCount(4);
    await expect(page.getByTestId("ayah-1-text")).toHaveAttribute("dir", "rtl");
  });

  test("surligne l'ayah correspondant a la position", async ({ page }) => {
    await stubAudio(page, 112);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");
    await waitForMetadata(page);

    const target = timings(112).ayat[2]; // 3e ayah
    const seconds = (target[1] + 200) / 1000;
    await seekTo(page, seconds);

    await expect(page.getByTestId(`ayah-${target[0]}`)).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("ayah-1")).toHaveAttribute("data-active", "false");
  });

  // Les deux branches assertent : le test ne peut pas devenir vide.
  test("le badge est present exactement quand la precision n'est pas exacte", async ({ page }) => {
    const precision = timings(7).precision;
    await stubAudio(page, 7);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "7");

    const badge = page.locator(".badge");
    if (precision === "exact") {
      await expect(badge).toHaveCount(0);
    } else {
      await expect(badge).toBeVisible();
    }
  });
});
```

**Vérifier** : `npx playwright install chromium` une fois, puis `npm run e2e`.

**Commit** : `test(e2e): parcours de lecture avec audio simule`

---

## Critères de fin du plan

- [ ] `npm test` passe (suite unitaire verte)
- [ ] `npm run typecheck` passe sans erreur
- [ ] `npm run build` produit `dist/`
- [ ] `npm run e2e` passe sans réseau externe
- [ ] `src/data/ingest-report.json` indique `pages.diffs = 0` et `juz.total = 17`
- [ ] `npm run ingest` est **idempotent** : deux exécutions produisent des fichiers identiques
      (vérifier avec `git status` propre après la seconde)
- [ ] La police est chargée en réseau (`font-display: swap`) et aucun avertissement de police
      dans la console
- [ ] Sourate 112, 36 et 1 s'affichent correctement, texte et audio synchronisés
- [ ] Le texte affiché conserve les 14 codepoints étendus dans le DOM (vérifier dans DevTools)

## Suite

À l'issue de ce plan, écrire les plans 2 (page du Coran / SVG), 3 (recherche et signets) et
4 (i18n et finitions), chacun repartant des types et invariants établis ici.
