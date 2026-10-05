# CLAUDE.md

Projet : lecteur Coran Warsh/Hafs (React 19 + TypeScript + Vite + Vitest + Playwright).
Worktree de travail : `.worktrees\socle`, branche `feat/socle-warsh`.
Toutes les commandes s'executent depuis ce worktree (jamais depuis la racine principale).

## Conventions

- Pas d'accent dans les commentaires, noms de tests, messages de commit ni docs du plan.
  Accents autorises dans les chaines visibles a l'utilisateur (`labelFr`, `aria-label`).
- TDD : test d'abord, constater l'echec, implémenter, constater le succes.
  Une tache = un commit. Fin de chaque tache : `npm test` + `npm run typecheck`
  + `npm run build` verts avant de commiter.
- Pas de reseau dans les tests unitaires. Pas de traces `[DBG]`.
- Ne pas modifier `scripts/ingest.mjs`, `src/data/quran-warsh.json`, ni regenerer
  `src/data/meta.json` (`manifest.mjs` est la source unique, avec test anti-derive).
- `CACHE_NAME = "coran-warsh-ayah-v1"` ne change pas.
- Conserver titre de page, decoration « Nuit enluminee », zoom
  `clamp(1.55rem, 3.4vw, 3.25rem)` via `var(--corps-verset)`, autoplay a la changement de sourate.
- Fin des commits : `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Plan actif — `docs/superpowers/plans/2026-10-04-warsh-hafs.md`

Taches 1 a 9 COMPLETEES (2026-10-05). Detail des commits et ecarts au plan :
section « Plan double lecture Warsh/Hafs » de `sdd/progress.md`.

| # | Tache | Fichiers principaux | Risque / note |
|---|-------|---------------------|----------------|
| 2 | Recitants par riwaya dans le manifeste | `scripts/lib/manifest.mjs`, `src/types.ts`, nouveau `tests/unit/manifest.test.ts` | Table 3 → 8 recitants (1 Warsh, 7 Hafs) + test anti-derive `meta.json`. Regressions attendues a ce stade : `ayah-source.test.ts`, `components.test.tsx` (rouges jusqu'a T5/T7) |
| 3 | Resolution riwaya → corpus | nouveau `src/data/corpora.ts` + test | Leger. Invariant : totaux 6214 ≠ 6236 |
| 4 | Session porte la riwaya | `src/state/session.ts` + nouveau `tests/unit/session.test.ts` | Revalider `reciter` dans l'initialiseur `useState` (ids 2/3 changent de sens entre modes) ; fallback Warsh pour session legacy sans `riwaya` |
| 5 | URL everyayah adaptee a la riwaya | `src/audio/ayah-source.ts` + fixtures du test | Petit correctif ; fait repasser `ayah-source.test.ts` |
| 6 | Riwaya dans la cle de redemarrage (tache CRITIQUE) | `src/audio/use-ayah-player.ts` + 2 tests | 64 sourates ont meme longueur dans les deux corpus → sans `riwaya` dans `memeLecture`, pas de redemarrage. Deux tests : en lecture ET en pause |
| 7 | Selecteur de mode UI | `App.tsx`, `PlayerBar.tsx`, tests (`player-bar`, `components`, nouveau `app-modes`) | Selecteur Warsh/Hafs, corpus dynamique, timings limites au Warsh, titre dynamique, selecteur recitant masque en Warsh ; cas sourate 5 (122 vs 120) |
| 8 | Police Amiri Quran pour Hafs | `manifest.mjs`, `src/assets/fonts/`, `fonts.css`, `app.css`, `font-coverage` + `styles` tests | TTF ~137 Ko ; test cmap 69/69 codepoints, 0 dans la police Warsh ; retirer `font-family` de base de `.ayah-text` |
| 9 | Verification finale et nettoyage | `sdd/progress.md`, nettoyage | Supprimer `tailles-baqarah.json` + `decoupage-baqarah.json`, verifs `[DBG]`/imports, gates complets **+ `npm run e2e`**, controle d'ecoute manuel Hafs (5 etapes) |

Attentes intermediaires assumees : suite verte en T2-T5 sauf les regressions
documentees (redeviennent vertes en T5/T7) ; vert complet des T7 fini ;
e2e seulement en T9.

## Etat

- Suite actuelle : `npm test` 182/182 (23 fichiers), `npm run typecheck` vert,
  `npm run build` vert, `npm run e2e` 7/7 — plan Warsh/Hafs clos hors etape 6
  de la T9 (controle d'ecoute manuel Hafs, humain, en attente).
- Artefacts de sondage (`tailles-baqarah.json`, `decoupage-baqarah.json`)
  supprimes en T9.
  `correction.txt` n'est pas reference par le plan — laisser tel quel.
