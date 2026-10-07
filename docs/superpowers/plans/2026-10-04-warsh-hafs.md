# Lecture Warsh + Hafs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le montage « trois recitants Warsh, dont deux desynchronises » par deux lectures cloisonnees — Warsh et Hafs — chacune avec son corpus de texte et sa liste de recitants alignes, choisissables dans la barre de lecture.

**Architecture:** Un nouveau corpus `quran-hafs.json` (6236 versets, api.quran.com) cohabite avec `quran-warsh.json` (6214 versets). Un nouveau module `corpora.ts` est le point unique de resolution `riwaya -> corpus`. Les recitants everyayah portent un champ `riwaya` ; deux accesseurs dans `manifest.mjs` remplacent la selection globale. Le mode vit dans l'etat de session ; la riwaya entre dans la cle de redemarrage de `use-ayah-player`, sans quoi 64 sourates sur 114 conserveraient leur position au changement de mode.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + Testing Library, scripts Node `.mjs` pour les ingests, CSS a plat.

**Spec:** `docs/2026-10-04-coran-warsh-hafs-design.md`

## Global Constraints

- Tous les commentaires, noms de tests et documentation sont ecrits **sans accents** (convention du depot ; voir `scripts/lib/manifest.mjs`, `docs/superpowers/plans/2026-09-28-coran-par-verset.md`). Les accents sont autorises dans les chaines destinees a l'utilisateur (`labelFr`, `aria-label`).
- Aucun test unitaire ne touche le reseau. Les.tests lisent des fixtures versionnees et des fichiers du depot.
- Toute commande se lance depuis `C:\Users\sadeq\Desktop\coran\.worktrees\socle`.
- Chaque tache se termine par `npm test`, `npm run typecheck`, `npm run build` — les trois verts — puis un commit.
- `scripts/ingest.mjs` et `src/data/quran-warsh.json` ne sont **pas** modifies : le corpus Warsh reste produit par son ingest actuel, qui necessite le zip KFGQPC (absent du depot).
- `src/data/meta.json` n'est pas regenere. `App.tsx` cesse de lire `meta.json.ayahReciters` ; `manifest.mjs` devient l'unique source (tache 2 pose le test anti-drift).
- `CACHE_NAME = "coran-warsh-ayah-v1"` reste tel quel dans `src/audio/audio-store.ts` (le Cache Storage est indexe par URL ; `/data/warsh/...` et `/data/...` ne peuvent pas entrer en collision).
- Aucun trace `[DBG]` dans l'arbre.
- Le `title` de la page, le decoratif « Nuit enluminee », le zoom `clamp(1.55rem, 3.4vw, 3.25rem)` via `var(--corps-verset)` et l'autoplay au changement de sourate sont preserves.

## Review Focus

Cinq entrees qu'une personne utiliserait normalement et qu'aucune tache ne couvre par ses assertions tant qu'on ne l'a pas ecrit. Chacune est desormais assignee a une tache.

1. **Une session enregistree avant ce changement** (pas de cle `riwaya`) doit s'ouvrir en Warsh et non planter ni rendre `undefined` comme corpus. → Tache 4.
2. **Un identifiant de recitant enregistre (1, 2 ou 3) qui designates recouvre d'autres voix** : les ids 2 et 3 passent de Al-Dosari-Warsh / Yassin-Al-Jazaery a des recitants Hafs. Une session persistante `reciter: 2` deviendrait silencieusement *une autre voix*, pas une erreur. → Tache 4 (fallback), verifie en Tache 7.
3. **Un verset hors range dans le nouveau corpus** : la sourate 5 compte 122 ayat en Warsh et 120 en Hafs. Une session a `ayah: 122` passe en Hafs sur la sourate 5 : il faut ecarter vers 1, pas lever. → Tache 4.
4. **Telecharger en mode Hafs** : `DownloadPanel` bat une liste d'unites depuis le corpus ; s'il lisait encore le corpus Warsh ou `timings/120`, un download Hafs serait court de 22 ayat. → Tache 7.
5. **Changer de mode pendant que ca joue, puis pendant une pause** : dans les deux cas on doit revenir au verset 1 et (re)demarrer. → Tache 6, deux tests.

---

### Task 1: Corpus Hafs (ingest, JSON, fixture)

**Files:**
- Create: `scripts/ingest-hafs.mjs`
- Create: `src/data/quran-hafs.json` (genere)
- Create: `scripts/fixtures/hafs-surah-counts.json` (genere)
- Test: `tests/unit/hafs-corpus.test.ts`

**Interfaces:**
- Consumes: rien ( premiere tache ).
- Produces: `src/data/quran-hafs.json` de la forme `{ meta: { riwaya: "hafs", source: string, ayahCount: 6236, surahCount: 114, pageCount: number, juzCount: number }, surahs: [{ n, en, ar, a: [[juz, page, text], ...] }] }` ; et `scripts/fixtures/hafs-surah-counts.json` de la forme `{ "<n>": <verses_count>, ... }` sur les 114 sourates. Taches 3, 4 et 7 importent le premier.

- [ ] **Step 1: Ecrire le test qui valide le corpus contre la fixture**

`tests/unit/hafs-corpus.test.ts` — pattern de `tests/unit/parse-kfgqpc.test.ts` (lecture de fichier + JSON.parse). Le test **ne fait aucun appel reseau** : il compare le corpus a la fixture versionnee.

```ts
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { QuranData } from "../../src/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const corpus = JSON.parse(
  readFileSync(join(ROOT, "src", "data", "quran-hafs.json"), "utf8"),
) as QuranData;
const counts = JSON.parse(
  readFileSync(join(ROOT, "scripts", "fixtures", "hafs-surah-counts.json"), "utf8"),
) as Record<string, number>;
```

Assertions, chacune dans son `it` :
- `corpus.surahs` a 114 elements, numerotes 1 a 114 dans l'ordre (`corpus.surahs[i].n === i + 1`).
- `corpus.meta.riwaya === "hafs"` et `corpus.meta.ayahCount === 6236`.
- `corpus.meta.ayahCount` egale la somme de `surahs[i].a.length`.
- Pour chaque sourate, `surahs[i].a.length === Number(counts[String(surahs[i].n)])` — c'est la verification contre `verses_count` d'api.quran.com.
- La sourate 2 a **286** versets (285 en Warsh : c'est la difference mesuree).
- Chaque ligne `a[i]` est un tableau de longueur 3, `[juz, page, text]`, avec `text` non vide, `juz` dans 1..30 et `page` dans 1..604.
- `meta.juzCount === 30`, `meta.pageCount === 604`.

- [ ] **Step 2: Lancer le test et verifier qu'il echoue**

Run: `npm test -- tests/unit/hafs-corpus.test.ts`
Expected: FAIL — `ENOENT` sur `src/data/quran-hafs.json` (le fichier n'existe pas encore).

- [ ] **Step 3: Ecrire `scripts/ingest-hafs.mjs`**

Script autonome (aucun import de `scripts/lib/*` : il n'a rien a voir avec KFGQPC). Comportement :

1. `GET https://api.quran.com/api/v4/chapters` -> `{ chapters: [{ id, name_simple, verses_count, ... }] }`. Construire `expected = Map<id, verses_count>`. **Valider** que `expected.size === 114`.
2. Pour `n` de 1 a 114, dans l'ordre : `GET https://api.quran.com/api/v4/verses/by_chapter/{n}?fields=text_uthmani&page_numbers=true&juz_numbers=true`.
   - Si `!res.ok` **ou** si `content-type` ne contient pas `json` **ou** si `JSON.parse` echoue : echouer avec le statut HTTP et l'URL. Ne jamais traiter une reponse HTML comme un corpus vide — c'est exactement ce qui a produit un fichier de 31 sourates lors d'un rate limit.
   - Trier les versets par `verse_key` (croissant) avant de construire les lignes.
   - Verifier `verses.length === expected.get(n)` ; si l'ecart existe, abortter en citant sourate, obtenu et attendu.
   - Ligne = `[verse.juz_number, verse.page_number, verse.text_uthmani]`.
3. Ecrire `scripts/fixtures/hafs-surah-counts.json` depuis `expected`, puis `src/data/quran-hafs.json` avec `meta = { riwaya: "hafs", source: "api.quran.com/api/v4 (Tanzil uthmani)", ayahCount, surahCount: 114, pageCount: 604, juzCount: 30 }` et `surahs: [{ n, en: name_simple, ar: name_arabic, a }]`.

Utiliser `writeJsonAtomic` de `scripts/lib/io.mjs` (il existe deja, meme signature que celle employee par `ingest.mjs` : `(chemin, objet)`), pour rester coherent avec le depot.

Ajouter un delai de 100 ms entre deux sourates : l'API a rate-limite une rafale de 114 requetes.

- [ ] **Step 4: Lancer l'ingest**

Run: `node scripts/ingest-hafs.mjs`
Expected: se termine sur un compte de 114 sourates et de 6236 versets, et ecrit les deux fichiers. En cas d'echec, ne pas passer a la suite : corriger et relancer (l'ecriture est atomique, donc un run interrompu ne laisse pas de fichier a moitie ecrit).

- [ ] **Step 5: Lancer le test et verifier qu'il passe**

Run: `npm test -- tests/unit/hafs-corpus.test.ts`
Expected: PASS (14 sourates comptees une fois, tous les `it` verts).

- [ ] **Step 6: Verifier l'ensemble**

Run: `npm test` puis `npm run typecheck` puis `npm run build`
Expected: les trois verts. `npm run build` echouerait si `resolveJsonModule` n'accepte pas la forme du fichier ; dans ce cas ajuster le cast dans le test plutot que le fichier.

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest-hafs.mjs scripts/fixtures/hafs-surah-counts.json src/data/quran-hafs.json tests/unit/hafs-corpus.test.ts
git commit -m "feat(data): ajoute le corpus Hafs 6236 versets depuis api.quran.com"
```

---

### Task 2: Recitants par riwaya dans le manifeste

**Files:**
- Modify: `scripts/lib/manifest.mjs:85-125` (`EVERYAYAH_BASE`, `AYAH_RECITERS`, `selectAyahReciter`)
- Modify: `src/types.ts:1-66` (ajout de `Riwaya`, `riwaya` sur `AyahReciter`, `meta.riwaya` elargi)
- Test: `tests/unit/manifest.test.ts` (nouveau)

**Interfaces:**
- Consumes: rien.
- Produces :
  - `type Riwaya = "warsh" | "hafs"` dans `src/types.ts`.
  - `AyahReciter` gagne `riwaya: Riwaya`.
  - `QuranData.meta.riwaya: Riwaya` (au lieu de `"warsh"` litteral).
  - `manifest.mjs` : `EVERYAYAH_BASE_WARSH` (la valeur actuelle `"https://everyayah.com/data/warsh"`), `EVERYAYAH_BASE_HAFS` (`"https://everyayah.com/data"`), `everyayahBase(riwaya)`, `rewayaReciters(riwaya)`, `defaultAyahReciter(riwaya)`. `EVERYAYAH_BASE` reste exporte comme alias de la base Warsh (les tests existants l'importent).
  - Taches 5, 6 et 7 consomment `everyayahBase`, `rewayaReciters` et `defaultAyahReciter`.

**Note de conception :** `AYAH_RECITERS` passe de 3 a 8 entrees. Les ids 1..8 restent globaux et uniques (Warsh = 1, Hafs = 2..8). Aucun id n'est partage entre les deux modes : c'est ce qui permet a `selectAyahReciter(id)` de rester une recherche globale sans ambiguite.

Les sept recitants Hafs, avec les dossiers **verifies a 6236 versets et zero divergence sur 114 sourahs** (`hafs-reciters-audit.json`) :

| id | `dir` | `labelFr` |
| --- | --- | --- |
| 2 | `Husary_128kbps` | `Khalil Al-Husary (Hafs, 128 kbps)` |
| 3 | `Yasser_Ad-Dussary_128kbps` | `Ibrahim Al-Dosari (Hafs, 128 kbps)` |
| 4 | `Minshawy_Murattal_128kbps` | `Al-Minshawi (Hafs, Murattal)` |
| 5 | `Mohammad_al_Tablaway_128kbps` | `Muhammad al-Tablaway (Hafs, 128 kbps)` |
| 6 | `Abdurrahmaan_As-Sudais_192kbps` | `Abdurrahmaan As-Sudais (Hafs, 192 kbps)` |
| 7 | `Hani_Rifai_192kbps` | `Hani Rifai (Hafs, 192 kbps)` |
| 8 | `Abdul_Basit_Murattal_192kbps` | `Abdul Baasit (Hafs, Murattal 192 kbps)` |

Le recitant **par defaut** de chaque mode est `priority: 0` dans son mode : id 1 en Warsh, id 2 en Hafs. `Yasser_Ad-Dussary_128kbps` est le meme lecteur que l'ancien `warsh_ibrahim_aldosary_128kbps`, mais dans son dossier Hafs ; c'est le dossier `warsh/` qui etait defectueux.

- [ ] **Step 1: Ecrire le test du manifeste**

`tests/unit/manifest.test.ts`, nouveau. Importer `AYAH_RECITERS`, `rewayaReciters`, `defaultAyahReciter`, `everyayahBase`, `selectAyahReciter` depuis `manifest.mjs`, et `readFileSync` de `src/data/meta.json` pour le garde-fou anti-drift.

Assertions :
- `rewayaReciters("warsh")` a **1** element, `rewayaReciters("hafs")` a **7**.
- `defaultAyahReciter("warsh").id === 1`, `defaultAyahReciter("hafs").id === 2`.
- `defaultAyahReciter(riwaya)` est toujours membre de `rewayaReciters(riwaya)`.
- Les `id` de `rewayaReciters("warsh")` et de `rewayaReciters("hafs")` sont **disjoints** (`Set` de taille 8 au total).
- Chaque recitant de `rewayaReciters(r)` a `r.riwaya === r` (le champ est coherent avec la liste dont il vient).
- Les 7 dossiers Hafs sont exactement, dans l'ordre : `Husary_128kbps`, `Yasser_Ad-Dussary_128kbps`, `Minshawy_Murattal_128kbps`, `Mohammad_al_Tablaway_128kbps`, `Abdurrahmaan_As-Sudais_192kbps`, `Hani_Rifai_192kbps`, `Abdul_Basit_Murattal_192kbps`.
- Aucun dossier Hafs ne commence par `warsh_`, et le seul dossier Warsh est `warsh_Abdul_Basit_128kbps` (garde-fou contre le piege du prefixe `/data/warsh`).
- `everyayahBase("warsh") === "https://everyayah.com/data/warsh"` et `everyayahBase("hafs") === "https://everyayah.com/data"`.
- `selectAyahReciter("2")` renvoie le recitant Hafs id 2 (`Yasser_Ad-Dussary_128kbps`) — la resolution globale reste non ambigue.
- **Anti-drift** : `meta.json.ayahReciters`, relu du disque, est exactement le tableau des recitants Warsh — memes `id`, `dir`, `bitrate`, `labelFr`, `priority`. Le fichier n'est pas regenere par ce plan ; ce test dit que s'il change un jour, `manifest.mjs` doit changer avec.

- [ ] **Step 2: Lancer le test et verifier qu'il echoue**

Run: `npm test -- tests/unit/manifest.test.ts`
Expected: FAIL — `rewayaReciters is not a function`.

- [ ] **Step 3: Implementer `Riwaya` et le champ dans `src/types.ts`**

- [ ] **Step 4: Implementer le manifeste**

Dans `manifest.mjs` : renommer `EVERYAYAH_BASE` en `EVERYAYAH_BASE_WARSH` (garder `EVERYAYAH_BASE` exporte en alias pour ne pas casser `tests/unit/ayah-source.test.ts` a cette tache), ajouter `EVERYAYAH_BASE_HAFS`, `everyayahBase(riwaya)`, `rewayaReciters(riwaya)` (filtre sur `riwaya`, sans copie), `defaultAyahReciter(riwaya)` (l'entree `priority === 0` du mode, leve une `Error` explicite si absent — un defaut muet serait un mode sans voix), et reecrire `AYAH_RECITERS` selon le tableau ci-dessus.

Corriger aussi le commentaire de `EVERYAYAH_BASE` : il dit aujourd'hui que les trois repertoires ont ete verifies, ce qui n'est plus vrai et qui explique *pourquoi* (les deux autres etaient defectueux, pas mal nommes).

- [ ] **Step 5: Lancer le test et verifier qu'il passe**

Run: `npm test -- tests/unit/manifest.test.ts`
Expected: PASS.

- [ ] **Step 6: Regressions attendues**

Run: `npm test`
Expected: `tests/unit/ayah-source.test.ts` et `tests/unit/components.test.tsx` peuvent echouer : ils cherchent `reciters.find((r) => r.priority === 0)` et `reciters.find((r) => r.id === 2)` en supposant les trois anciens recitants Warsh. Corriger ces fixtures dans les etapes suivantes plutot que de les assouplir ici - la tache 5 et la tache 7 les remettent a niveau. Ne pas toucher `font.test.ts` (il ne parle pas de recitants).

- [ ] **Step 7: Verifier l'ensemble**

Run: `npm run typecheck` puis `npm run build`
Expected: verts. (`npm test` est attendu rouge a ce stade — c'est la liste de la tache 5 et de la tache 7.)

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/manifest.mjs src/types.ts tests/unit/manifest.test.ts
git commit -m "feat(data): repartit les recitants everyayah par riwaya"
```

---

### Task 3: Resolution `riwaya -> corpus`

**Files:**
- Create: `src/data/corpora.ts`
- Test: `tests/unit/corpora.test.ts` (nouveau)

**Interfaces:**
- Consumes: `Riwaya` (tache 2), `src/data/quran-warsh.json`, `src/data/quran-hafs.json` (tache 1).
- Produces: `export function corpusOf(riwaya: Riwaya): QuranData` et `export const RIWAYAS: readonly Riwaya[]` (`["warsh", "hafs"]`, pour peupler le `<select>` de mode sans dupliquer la liste). La tache 7 utilise les deux.

- [ ] **Step 1: Ecrire le test**

`tests/unit/corpora.test.ts` :
- `corpusOf("warsh")` et `corpusOf("hafs")` renvoient deux objets **distincts**.
- Warsh : `meta.riwaya === "warsh"`, total 6214, sourate 2 = 285 versets.
- Hafs : `meta.riwaya === "hafs"`, total 6236, sourate 2 = 286 versets.
- Les deux ont 114 sourates.
- Les deux totaux sont **differents** — c'est l'invariant qui justifie toute la construction ; si un jour ils convergent, la double lecture n'a plus de raison d'etre et ce test doit echouer.
- `RIWAYAS` vaut exactement `["warsh", "hafs"]`.
- Chaque sourate de chaque corpus a un `n` entre 1 et 114 et `a.length >= 1`.

- [ ] **Step 2: Lancer le test et verifier qu'il echoue**

Run: `npm test -- tests/unit/corpora.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implementer `src/data/corpora.ts`**

Importer les deux JSON et les caster en `QuranData`. Les deux fichiers ont la meme forme, donc le meme cast que celui utilise dans `App.tsx` (`quran as unknown as QuranData`).

- [ ] **Step 4: Lancer le test et verifier qu'il passe**

Run: `npm test -- tests/unit/corpora.test.ts`
Expected: PASS.

- [ ] **Step 5: Verifier l'ensemble**

Run: `npm run typecheck` puis `npm run build`
Expected: verts. Le bundle gagne le corpus Hafs ; c'est le seul cout de cette tache (voir Risques du spec, section 13).

- [ ] **Step 6: Commit**

```bash
git add src/data/corpora.ts tests/unit/corpora.test.ts
git commit -m "feat(data): ajoute la resolution riwaya vers corpus"
```

---

### Task 4: Etat de session porte la riwaya

**Files:**
- Modify: `src/state/session.ts:3-22`
- Test: `tests/unit/session.test.ts` (nouveau)

**Interfaces:**
- Consumes: `Riwaya`, `rewayaReciters`, `defaultAyahReciter` (tache 2).
- Produces: `SessionState` gagne `riwaya: Riwaya` ; `useSession` gagne `setRiwaya(riwaya: Riwaya)`. `initial: Partial<SessionState>` reste accepte, donc une session existante sans `riwaya` passe toujours. La tache 7 consomme `state.riwaya` et `setRiwaya`.

Trois pieges traites ici (Review Focus 1, 2 et 3) :
- **Retrocompatibilite** : une session sans `riwaya` se lit `"warsh"`.
- **Recitant devenu invalide** : les ids 2 et 3 changeant de sens, une session persistante `reciter: 2` ne doit pas selectionner un lecteur Hafs en mode Warsh. `setRiwaya` (et l'initialisation) doivent **revalider** le recitant contre le mode et retomber sur `defaultAyahReciter(riwaya)`.
- **Ayah hors range** : `setRiwaya` ne connait pas la longueur de la sourate (elle n'est pas dans son scope) — c'est `App.tsx` qui borne, tache 7. Ce test verifie seulement que `setRiwaya` remet `ayah` a `null`, pas qu'il conserve un verset devenu invalide.

- [ ] **Step 1: Ecrire le test**

`tests/unit/session.test.ts`, avec `renderHook` / `act` de `@testing-library/react`, sur le meme modele que `tests/unit/use-ayah-player.test.tsx` (qui porte `/** @vitest-environment jsdom */` en tete de fichier ; ce fichier-la doit aussi le porter, l'environnement global etant `node`).

Assertions :
- `useSession()` donne `riwaya === "warsh"`, `surah === 1`, `reciter === 1`, `ayah === null`.
- `useSession({ reciter: 3 })` **sans** `riwaya` retombe sur le recitant Warsh valide : `reciter === 1` (le 3 est un id Hafs a ce jour, il ne peut pas selectionner une voix Warsh).
- `setSurah(18)` met `ayah` a `null` et laisse `riwaya` intacte.
- `setRiwaya("hafs")` met `riwaya` a `"hafs"`, `reciter` a `2` (defaut Hafs) et `ayah` a `null`, **et conserve `surah`**.
- `setRiwaya("hafs")` puis `setRiwaya("warsh")` remet `reciter` a `1` et `ayah` a `null`.
- `setReciter(7)` puis `setRiwaya("warsh")` retombe sur `1` : le recitant memorise appartient a l'autre mode.
- `setAyah(3)` puis `setRiwaya("hafs")` met `ayah` a `null` (pas de verset conserve a travers un changement de decoupage).

- [ ] **Step 2: Lancer le test et verifier qu'il echoue**

Run: `npm test -- tests/unit/session.test.ts`
Expected: FAIL — `setRiwaya is not a function`.

- [ ] **Step 3: Implementer `src/state/session.ts`**

- `SessionState.riwaya: Riwaya`.
- L'initialisation applique `{ surah: 1, ayah: null, riwaya: "warsh", ...initial }`, puis **revalide** `reciter` : s'il n'est pas dans `rewayaReciters(riwaya).map((r) => r.id)`, le remplacer par `defaultAyahReciter(riwaya).id`. Cette revalidation doit tourner dans l'initialiseur de `useState` (une fois), pas dans un `useEffect`, pour ne pas provoquer un premier rendu avec une voix invalide.
- `setRiwaya(riwaya)` : `{ ...s, riwaya, reciter: defaultAyahReciter(riwaya).id, ayah: null }`.
- Commenter en tete de fichier pourquoi la revalidation existe (ids 2 et 3 recouvre de sens) — c'est le piege que le prochain lecteur ne verra pas.

- [ ] **Step 4: Lancer le test et verifier qu'il passe**

Run: `npm test -- tests/unit/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Verifier l'ensemble**

Run: `npm run typecheck` puis `npm run build`
Expected: verts. (`npm test` reste rouge sur les fixtures de recitants, prevu a la tache 2 et repris a la tache 5 et 7.)

- [ ] **Step 6: Commit**

```bash
git add src/state/session.ts tests/unit/session.test.ts
git commit -m "feat(state): porte la riwaya en session et revalide le recitant"
```

---

### Task 5: URL everyayah adaptee a la riwaya

**Files:**
- Modify: `src/audio/ayah-source.ts:6,29-45`
- Modify: `tests/unit/ayah-source.test.ts` (fixtures qui cherchaient les anciens recitants)

**Interfaces:**
- Consumes: `everyayahBase`, `AyahReciter.riwaya` (tache 2).
- Produces: `ayahUrl(reciter, surah, ayah, ayahCount)` — **signature inchangee**. La riwaya se lit sur `reciter.riwaya`, donc aucun appelant ne change.

Le prefixe `/data/warsh` de la base est un prefixe de **dossier**, pas une convention de nommage : les recitants Warsh vivent sous `/data/warsh/<dir>/`, les recitants Hafs sous `/data/<dir>/`. Le format du nom de fichier (`NNNMMM.mp3`) est identique des deux cotes.

- [ ] **Step 1: Ecrire les tests**

Dans `tests/unit/ayah-source.test.ts`, remplacer les fixtures quiCherchaient les anciens recitants :
- `abdulBasit` devient `rewayaReciters("warsh")[0]` (le comportement existant — `https://everyayah.com/data/warsh/warsh_Abdul_Basit_128kbps/112001.mp3` — doit rester **exactement** identique ; c'est une non-regression).
- Le test « utilise le repertoire du recitant passe » porte desormais sur un recitant Hafs : `ayahUrl(rewayaReciters("hafs")[0], 112, 1, 4)` vaut `https://everyayah.com/data/Husary_128kbps/112001.mp3` — **sans** le segment `warsh`.
- Nouveau test : les deux modes ne se confondent pas — pour un meme `surah`/`ayah`, l'URL Warsh contient `/data/warsh/` et l'URL Hafs ne le contient pas.
- Le reste du fichier (`pad3`, bornes `RangeError`) est inchange.

- [ ] **Step 2: Lancer le test et verifier qu'il echoue**

Run: `npm test -- tests/unit/ayah-source.test.ts`
Expected: FAIL sur l'URL Hafs (actuellement `https://everyayah.com/data/warsh/Husary_128kbps/112001.mp3`).

- [ ] **Step 3: Modifier `ayah-source.ts`**

Remplacer l'import de `EVERYAYAH_BASE` par `everyayahBase`, et la ligne 44 par `everyayahBase(reciter.riwaya)` a la place de `EVERYAYAH_BASE`. Mettre a jour le commentaire d'en-tete : le prefixe depend du mode, le nom de fichier non.

- [ ] **Step 4: Lancer le test et verifier qu'il passe**

Run: `npm test -- tests/unit/ayah-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Verifier l'ensemble**

Run: `npm test` puis `npm run typecheck` puis `npm run build`
Expected: les trois verts, a l'exception eventuelle de `tests/unit/components.test.tsx` (voir tache 2, etape 6 ; corrige a la tache 7).

- [ ] **Step 6: Commit**

```bash
git add src/audio/ayah-source.ts tests/unit/ayah-source.test.ts
git commit -m "fix(audio): choisit la base everyayah selon la riwaya"
```

---

### Task 6: La riwaya dans la cle de redemarrage (tache critique)

**Files:**
- Modify: `src/audio/use-ayah-player.ts:28-39` (`UseAyahPlayerOptions`), `:198` (`lastKeyRef.current`), `:181` (dependances de l'effet de construction)
- Modify: `tests/unit/use-ayah-player.test.tsx` (helper `makeRig` / `render`, et deux nouveaux tests)

**Interfaces:**
- Consumes: `Riwaya` (tache 2).
- Produces: `UseAyahPlayerOptions` gagne `riwaya: Riwaya` (**obligatoire**, pas optionnel : une option facultative laisserait passer le bug que ce plan corrige). La tache 7 le transmet.

**Pourquoi c'est la tache centrale.** Ligne 200 :

```ts
lastKeyRef.current = { reciterId, surah, ayahCount };
const memeLecture = previous.surah === surah && previous.ayahCount === ayahCount;
```

Puis `position = memeLecture ? indexRef.current : 0` et `relancer = !memeLecture || playingRef.current`.

Mesure : **64 sourates sur 114 ont le meme nombre de versets dans les deux corpus**. Sur ces sourates, sans `riwaya` dans la cle, un changement de mode laisserait `memeLecture` vrai — donc la position serait conservee et la lecture ne redemarrerait pas, exactement l'inverse du comportement demande. La sourate 1 (7 versets dans les deux) est le cas de test le plus net.

- [ ] **Step 1: Ecrire le test qui echoue (Review Focus 5)**

Dans `tests/unit/use-ayah-player.test.tsx`, ajouter `riwaya` au helper `makeRig`/`render` (valeur par defaut `"warsh"`).

Premier test — **en lecture** :
```ts
it("repart du verset 1 quand la riwaya change sur une sourate de meme longueur", async () => {
  const render = makeRig(7);          // sourate 1 : 7 versets dans les deux corpus
  const { result, rerender } = render({ surah: 1 });
  await act(async () => { await result.current.play(); });
  await act(async () => { await result.current.seekAyah(5); });
  rerender({ surah: 1, riwaya: "hafs" });
  // ... assertions : index revenu a 0, et les octets demandes pour le verset 1
});
```
Meme forme pour le deuxieme test, **en pause** : `pause()` puis changement de riwaya, et l'index doit aussi revenir a 0.

Le nom du test doit nommer la condition (« sourate de meme longueur »), pas seulement le mecanisme : c'est ce qui empeche quelqu'un de simplifier le test plus tard en choissant une sourate ou les comptes different, ou le test passerait sans verifier ce qu'il pretend verifier.

- [ ] **Step 2: Lancer les tests et verifier qu'ils echouent**

Run: `npm test -- tests/unit/use-ayah-player.test.tsx`
Expected: FAIL — l'index reste a 4 au lieu de revenir a 0.

- [ ] **Step 3: Ajouter `riwaya` a la cle**

- `UseAyahPlayerOptions` : ajouter `riwaya: Riwaya;` et l'import de type depuis `../types`.
- `lastKeyRef.current = { reciterId, surah, ayahCount, riwaya }` et le type de `lastKeyRef` initial (ligne ~197) aligne.
- `memeLecture` devient `previous.surah === surah && previous.ayahCount === ayahCount && previous.riwaya === riwaya`.
- Ajouter `riwaya` aux dependances de l'effet de construction du scheduler (vers ligne 181) et a celles de l'effet de redemarrage (vers ligne 196).
- Ne pas dupliquer la comparaison dans une constante partagee : la comparaison elle-meme est la documentation.

- [ ] **Step 4: Lancer les tests et verifier qu'ils passent**

Run: `npm test -- tests/unit/use-ayah-player.test.tsx`
Expected: PASS, y compris les 20+ tests existants — le comportement sur changement de sourate et de recitant est inchange.

- [ ] **Step 5: Verifier l'ensemble**

Run: `npm test` puis `npm run typecheck` puis `npm run build`
Expected: les trois verts.

- [ ] **Step 6: Commit**

```bash
git add src/audio/use-ayah-player.ts tests/unit/use-ayah-player.test.tsx
git commit -m "fix(audio): la riwaya invalide l'ordonnanceur et relance au verset 1"
```

---

### Task 7: Interface — selecteur de mode, corpus, timings, titre

**Files:**
- Modify: `src/App.tsx:1-98`
- Modify: `src/components/PlayerBar.tsx:4-68`
- Modify: `tests/unit/player-bar.test.tsx`
- Modify: `tests/unit/components.test.tsx` (recitants du panneau de telechargement)
- Test: `tests/unit/app-modes.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `corpusOf`, `RIWAYAS` (tache 3), `state.riwaya`, `setRiwaya` (tache 4), `everyayahBase` (tache 5), `riwaya` du hook (tache 6), `rewayaReciters` (tache 2).
- Produces: `PlayerBarProps` gagne `riwaya: Riwaya`, `onRiwaya: (riwaya: Riwaya) => void`. `reciters` continue de recevoir **la liste du mode** deja filtree, donc `PlayerBar` n'a pas besoin de connaitre le manifeste.

Quatre comportements :
1. **Selecteur de mode** dans `PlayerBar`, `data-testid="player-riwaya"`, `id="riwaya-select"`, `name="riwaya"`, `aria-label="Lecture"`, une option par entree de `RIWAYAS` (`Warsh`, `Hafs`), `value` = mode courant.
2. **Select de recitant masque quand le mode n'a qu'un recitant** : la condition existante `reciters.length > 0` (ligne 52) devient `reciters.length > 1`. En Warsh il disparait ; en Hafs il liste les 7.
3. **Timings gates sur la riwaya** : l'effet de chargement de `App.tsx` (lignes 26-39) ne charge `timings/120/...` que si `state.riwaya === "warsh"`, et passe `null` sinon. Ces tables decrivent le moshaf Warsh (sourate 2 = 285 lignes) et sont desynchronisees sur le corpus Hafs. La dependance de l'effet gagne `state.riwaya`.
4. **Titre dynamique** : `<h1 className="app-title">Coran — {state.riwaya === "warsh" ? "Warsh" : "Hafs"}</h1>`.

Plus, dans `App.tsx` : `data = corpusOf(state.riwaya)` (le corpus suit le mode), `reciters = rewayaReciters(state.riwaya)`, et **`state.riwaya` remplace la source de `meta.json.ayahReciters`** — on lit `AYAH_RECITERS` via `rewayaReciters`, donc `meta.json` n'est plus lu pour les recitants. Retirer l'import de `meta.json` s'il n'a plus d'autre usage.

**Bornage de l'ayah (Review Focus 3 et 4).** La sourate 5 compte 122 ayat en Warsh et 120 en Hafs. Apres `setRiwaya`, `state.ayah` est `null` (tache 4), donc l'affichage est deja borne — mais `AyahList` et `DownloadPanel` recoivent `surah` et `currentAyahIndex` du **nouveau** corpus, donc coherent par construction. Il faut quand meme un test qui le prouve, parce que c'est la seule asymetrie entre les deux corpus (18 sourates ou Hafs a **moins** de versets).

- [ ] **Step 1: Ecrire les tests de `PlayerBar`**

Dans `tests/unit/player-bar.test.tsx`, le helper de rendu passe des props par defaut. Nouvelles assertions :
- Avec `reciters: rewayaReciters("warsh")` (1 element) et `riwaya: "warsh"` : `screen.queryByTestId("player-reciter")` est **null**.
- Avec `reciters: rewayaReciters("hafs")` (7 elements) et `riwaya: "hafs"` : le select existe, et `screen.getAllByRole("option")` contient les 7 `labelFr`.
- Le selecteur de mode existe dans les deux cas et propose exactement `Warsh` et `Hafs`.
- Choisir `Hafs` appelle `onRiwaya("hafs")` (une fois).
- Le `title` de chaque bouton et du select de recitant reste non vide (test existant) — il passe aussi pour le nouveau select : ajouter le nouveau select au tableau du test existant.
- `aria-label` sur le nouveau select : assert explicite, pour que le test de non-regression de `title` le couvre aussi.

- [ ] **Step 2: Ecrire le test d'intégration de l'application**

`tests/unit/app-modes.test.tsx` (nouveau, `/** @vitest-environment jsdom */`). Rendre `<App />` comme le fait la suite existante, en injectant un `AudioContext` et un `fetchBytes` factices si le composant en a besoin (reprendre le doublure de `tests/unit/use-ayah-player.test.tsx`).

Assertions :
- Le titre vaut `Coran — Warsh` au demarrage, `Coran — Hafs` apres selection.
- Le nombre de versets affiche change de mode : la position affichee `1 / 286` en Hafs sur la sourate 2 (contre `1 / 285` en Warsh). C'est la preuve que le corpus a change, pas seulement l'etiquette.
- Le badge `durees estimees` est present en Warsh et **absent** en Hafs (timings a `null`).
- Le select de recitant est absent en Warsh et present en Hafs dans l'application reelle, pas seulement sur le composant isole.
- Changer de mode sur la sourate 2 sans avoir joue ne leve pas d'exception et ne laisse pas de verset selectionne au-dela du total.
- Changer de mode puis revenir sur une sourate ou Hafs a moins de versets (sourate 5 : 122 -> 120) ne produit pas de verset 121 ou 122 dans le DOM ni d'URL audio hors range.

- [ ] **Step 3: Lancer les tests et verifier qu'ils echouent**

Run: `npm test -- tests/unit/player-bar.test.tsx tests/unit/app-modes.test.tsx`
Expected: FAIL — select de recitant toujours present en Warsh, pas de selecteur de mode, titre fige.

- [ ] **Step 4: Modifier `PlayerBar.tsx`**

Ajouter `riwaya` et `onRiwaya` aux props, poser le `<select>` de mode avant le select de recitant, passer `reciters.length > 1` a la condition d'affichage du select de recitant, et ajouter le nouveau select au tableau de test de `title`.

- [ ] **Step 5: Modifier `App.tsx`**

Brancher `corpusOf`, `rewayaReciters`, `setRiwaya`, `state.riwaya`, le `data-riwaya` sur `<main className="app-main">` (prepare pour la tache 8), le titre dynamique, le gate des timings, et retirer la lecture de `meta.json.ayahReciters`.

Passer `reciters={reciters}` a `PlayerBar` (liste deja filtree par mode) et `riwaya={state.riwaya}` `onRiwaya={setRiwaya}`.

- [ ] **Step 6: Lancer les tests et verifier qu'ils passent**

Run: `npm test -- tests/unit/player-bar.test.tsx tests/unit/app-modes.test.tsx`
Expected: PASS.

- [ ] **Step 7: Reprendre `components.test.tsx`**

`tests/unit/components.test.tsx` utilise `AYAH_RECITERS` pour le `DownloadPanel`. Le passer a `rewayaReciters("hafs")` : c'est la seule liste qui a plus d'un element, et c'est celle qui correspond au corpus de 6236 versets. Verifier aussi que le test de non-regression de `DownloadPanel` (ligne 60 : « donne un title et un aria-label au bouton de suivi ») tient toujours.

- [ ] **Step 8: Verifier l'ensemble**

Run: `npm test` puis `npm run typecheck` puis `npm run build`
Expected: les trois verts, suite complete.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/components/PlayerBar.tsx tests/unit/player-bar.test.tsx tests/unit/components.test.tsx tests/unit/app-modes.test.tsx
git commit -m "feat(ui): selecteur de lecture Warsh/Hafs avec corpus et timings dedies"
```

---

### Task 8: Police du texte Hafs et garde-fou de couverture

**Files:**
- Create: `src/assets/fonts/AmiriQuran-Regular.ttf` (vendored)
- Modify: `scripts/lib/manifest.mjs` (ajout de `AMIRI_QURAN`)
- Modify: `src/styles/fonts.css:1-11`
- Modify: `src/styles/app.css` (regle `.ayah-text`)
- Modify: `tests/unit/font.test.ts`
- Modify: `tests/unit/styles.test.ts`
- Test: `tests/unit/font-coverage.test.ts` (nouveau)

**Interfaces:**
- Consumes: `src/data/quran-hafs.json` (tache 1), `state.riwaya` expose via `data-riwaya` sur `<main>` (tache 7).
- Produces: aucune interface publique ; c'est une tache de rendu.

**Le fait mesure qui dicte le choix.** `QCF2001.ttf` (KFGQPC Hafs) a ete compare au corpus uthmani : ses trois sous-tables `cmap` (`(0,3)`, `(1,0)`, `(3,1)`) couvrent **0 des 69** codepoints du corpus. Ses glyphes vivent dans le codepage prive du complexe du Roi Fahd - `U+F777..U+F8A6`, `U+FB50`, `U+FC41..U+FC64`, `U+FD5A..U+FD79` - disjoint du texte Unicode standard `U+0600..U+06FF` d'api.quran.com. C'est aussi pourquoi la police Warsh actuelle fonctionne : `kfgqpc_warsh_v30.json` est encode dans ce meme codepage prive.

`AmiriQuran-Regular.ttf` couvre **69 / 69**. QCF2001 est donc ecarte (decision user). Le TTF complet est retenu plutot qu'un woff2 : un sous-ensemble peut ne pas couvrir les 69 codepoints, et la couverture est justement ce qu'on cherche a garantir. 137 Ko, contre les 618 Ko de la police Warsh deja embarquee.

**Emplacement de `font-family` :** la regle `.ayah-text` de `app.css` porte aujourd'hui `font-family: "KFGQPC Warsh", ...`. La remplacer par **deux regles portees par le mode**, et retirer `font-family` de la regle de base — la base ne garde que `display`, `text-align`, `font-size`, `line-height`, `color`, ce que `tests/unit/styles.test.ts` verifie deja. Les regles de mode sont de premier niveau, et fonctionnent donc avec l helper `declarationsFor` existant :

```css
[data-riwaya="warsh"] .ayah-text { font-family: "KFGQPC Warsh", "Traditional Arabic", "Amiri", serif; }
[data-riwaya="hafs"] .ayah-text { font-family: "Amiri Quran", "Traditional Arabic", serif; }
```

- [ ] **Step 1: Vendoriser la police et la figer dans le manifeste**

Telecharger `https://raw.githubusercontent.com/google/fonts/main/ofl/amiriquran/AmiriQuran-Regular.ttf` dans `src/assets/fonts/`. Dans `manifest.mjs`, ajouter un objet `AMIRI_QURAN` **de la forme de `KFGQPC.ttf`** (`{ path, md5 }`), avec la meme note de licence (`SIL Open Font License 1.1`) et la meme longueur de chaine de provenance que `KFGQPC.licenseNote`. Une police ne se fige pas moins qu'un corpus.

- [ ] **Step 2: Ecrire le test de couverture des glyphes**

`tests/unit/font-coverage.test.ts` (nouveau). C'est la permanence d'une investigation d'une fois : tant que ce test existe, un changement de police ne peut pas reintroduire des carres vides sans qu'un test le dise.

Parser la table `cmap` du TTF (formates 4 et 6 suffisent ; manages 12 par precaution), puis :
- Reperer tous les codepoints de `text` dans les 6236 lignes de `quran-hafs.json`, **moins** les espaces et les caracteres de direction ignorables (`U+0020`, `U+00A0`, `U+200B..U+200F`, `U+061C`).
- Assert : **69** codepoints distincts retenus (le nombre mesure ; s'il change, le message doit le dire).
- Assert : chacun est present dans la `cmap` d'Amiri Quran. Lister les codepoints manquants dans le message d'echec pour que le diagnostic soit immediate.
- Assert : chacun est present dans la `cmap` de `kfgqpc_warsh_v30.ttf` pour au plus **0** d'entre eux - c'est le fait etabli en section 2.6 du spec, et il justifie le choix de la police. Si ce test echoue un jour, c'est qu'une nouvelle version de la police Warsh a ete ajoutee : relire le spec avant de supprimer l'assert.

- [ ] **Step 3: Lancer le test et verifier qu'il passe**

Run: `npm test -- tests/unit/font-coverage.test.ts`
Expected: PASS immediatement (la police est deja verifiee a la main ; le test la fige).

- [ ] **Step 4: Etendre `font.test.ts`**

Ajouter un `describe("police Amiri Quran")` calque sur celui de KFGQPC : MD5 egal a `AMIRI_QURAN.md5`, et en-tete TrueType valide. Reutiliser `FONT`/`AMIRI` comme constantes de chemin.

- [ ] **Step 5: Ecrire le test CSS**

Dans `tests/unit/styles.test.ts`, ajouter un `describe("police du texte du Coran")` :
- `propertyOf(declarationsFor(CSS, '[data-riwaya="warsh"] .ayah-text'), "font-family")` commence par `"KFGQPC Warsh"`.
- `propertyOf(declarationsFor(CSS, '[data-riwaya="hafs"] .ayah-text'), "font-family")` commence par `"Amiri Quran"`.
- La regle de base `.ayah-text` **ne declare plus** `font-family` : `propertyOf(declarationsFor(CSS, ".ayah-text"), "font-family")` est `undefined`. Sans cet assert, une regle de base non retiree gagnerait par ordre de cascade dans un cas et perdrait dans l'autre, et le test passerait quand meme.

L'helper `declarationsFor` ancre sur `^` ou `}` : les deux selecteurs doivent donc etre ecrits **de premier niveau**, sans indentation de bloc parent.

- [ ] **Step 6: Lancer le test et verifier qu'il echoue**

Run: `npm test -- tests/unit/styles.test.ts`
Expected: FAIL — les regles `[data-riwaya=...]` n'existent pas.

- [ ] **Step 7: Ecrire les declarations**

- `fonts.css` : ajouter l'`@font-face` d'Amiri Quran (`src: url("../assets/fonts/AmiriQuran-Regular.ttf") format("truetype")`, `font-display: swap`), en conservant celle de KFGQPC Warsh.
- `app.css` : retirer `font-family` de `.ayah-text` (remplacer la ligne par le commentaire deplacement), ajouter les deux regles de mode, et ajuster le commentaire existant qui dit que la police vit dans `app.css` pour ne pas dependre de l'ordre d'import.

- [ ] **Step 8: Lancer les tests et verifier qu'ils passent**

Run: `npm test -- tests/unit/styles.test.ts tests/unit/font.test.ts tests/unit/font-coverage.test.ts`
Expected: PASS.

- [ ] **Step 9: Verifier l'ensemble et la taille du bundle**

Run: `npm test` puis `npm run typecheck` puis `npm run build`
Expected: les trois verts. Comparer la taille de `dist/assets/*.ttf` a celle d'avant : elle doit augmenter d'environ 137 Ko (la police Hafs), et le total rester inferieur a l'existant malgre les ~1 Mo du corpus Hafs en JSON compresse. Noter le chiffre dans le rapport de tache.

- [ ] **Step 10: Commit**

```bash
git add src/assets/fonts/AmiriQuran-Regular.ttf scripts/lib/manifest.mjs src/styles/fonts.css src/styles/app.css tests/unit/font.test.ts tests/unit/font-coverage.test.ts tests/unit/styles.test.ts
git commit -m "feat(typo): police Amiri Quran pour le texte Hafs, avec garde-fou de couverture"
```

---

### Task 9: Verification finale et nettoyage

**Files:**
- Delete: `tailles-baqarah.json`, `decoupage-baqarah.json` (artefacts de sondage, non utilises)
- Modify: `sdd/progress.md`

**Interfaces:**
- Consumes: tout.
- Produces: arbre propre et vert.

- [ ] **Step 1: Supprimer les artefacts de sondage**

`Remove-Item tailles-baqarah.json, decoupage-baqarah.json`. Ils ne sont ni importes ni testes ; ils sont la trace de songes de mesure anterieurs au mode double. Ne **pas** supprimer `audit-versets.json`, `hafs-reciters-audit.json` : ce sont les preuves de l'alignement, referencees dans le spec (section 15).

- [ ] **Step 2: Verifier l'absence de traces de debogage**

Run: `Select-String -Path src\**\*,tests\**\*,scripts\**\* -Pattern "\[DBG\]" -ErrorAction SilentlyContinue`
Expected: aucune sortie.

- [ ] **Step 3: Verifier qu'aucun module n'importe plus un corpus directement**

Run: `Select-String -Path src\**\*.ts,src\**\*.tsx -Pattern "quran-warsh.json|quran-hafs.json"`
Expected: seul `src/data/corpora.ts` (et `src/App.tsx` tant qu'il n'a pas ete nettoye — la tache 7 le bascule sur `corpusOf`).

- [ ] **Step 4: Suite complete**

Run: `npm test` puis `npm run typecheck` puis `npm run build`
Expected: les trois verts.

- [ ] **Step 5: E2E en navigateur (seul vrai controle du rendu)**

Run: `npm run e2e`
Expected: PASS. Cette etape n'est pas un formalisme : `tests/unit/styles.test.ts` lit la source CSS et ne peut pas voir le rendu ; le test navigateur est le seul qui verifie qu'un verset Hafs ne s'affiche pas avec des carres vides.

- [ ] **Step 6: Verification manuelle de la lecture Hafs (5 minutes)**

Ouvrir l'application et faire, dans l'ordre : (1) Warsh, choisir le seul recitant, jouer 3 versets, verifier surbrillance et son synchronises ; (2) passer en Hafs, verifier le retour au verset 1, la reprise de la lecture et l'apparition du select de recitant ; (3) changer de recitant Hafs en cours de lecture, verifier que le verset affiche et le verset joue restent identiques ; (4) aller sur la sourate 5 (122 ayat en Warsh, 120 en Hafs) et changer de mode dans les deux sens ; (5) retourner en Warsh et verifier que le select de recitant a disparu.

Le point (3) est le plus important : c'est le geste exact qui, dans l'ancien montage, produisait un decalage d'un verset.

- [ ] **Step 7: Mettre a jour la progression**

Dans `sdd/progress.md`, ajouter une section pour ce plan : plan `docs/superpowers/plans/2026-10-04-warsh-hafs.md`, taches 1 a 9 completees, et les deux mesures qui justifient l'architecture (64 sourates de meme longueur ; 7 recitants Hafs a zero divergence).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: nettoie les artefacts de sondage et met a jour la progression"
```

---

## Criteres de fin du plan

- `npm test`, `npm run typecheck`, `npm run build` et `npm run e2e` verts.
- Le corpus Hafs compte 6236 versets, valide sourate par sourate contre la fixture.
- `rewayaReciters("warsh")` = 1, `rewayaReciters("hafs")` = 7, ids disjoints.
- Changer de mode sur une sourate de meme longueur ramene a 0 et redemarre, en lecture comme en pause.
- Une session sans `riwaya`, ou avec un `reciter` devenu invalide, s'ouvre proprement en Warsh.
- Le select de recitant est absent en Warsh, present en Hafs.
- Le badge « durees estimees » est absent en Hafs.
- Chaque codepoint du corpus Hafs est couvert par la police Hafs, verifie par un test.

## Risques portes (a lire avant d'executer)

- **Le test de couverture de la police depend de `quran-hafs.json`.** Si la tache 1 est reexecutee et que le corpus change de forme, ce test doit changer aussi. Il est ecrit apres, volontairement.
- **`meta.json` n'est pas regenere.** Le test anti-drift de la tache 2 le signale si le fichier change un jour sans que `manifest.mjs` suive.
- **Le poids du bundle** : environ 1 Mo de JSON Hafs en plus. Strategie inchangee (les deux corpus sont embarques), mais c'est le point a surveiller en tache 8, etape 9.
- **Les ids de recitants 2 et 3 changent de sens.** Toute donnee persistee qui en depend doit passer par la revalidation de la tache 4. Si un jour une autre source conserve `reciter`, elle doit etre revisitee.