# Progression du plan

Plan : `docs/superpowers/plans/2026-09-27-coran-socle.md`
Branch : `feat/socle-warsh`

## Tâche 0-6 — Complétées
- T0 : setup, T1 : `084e1a0`, T2 : `16de7b8`, T3 : `4232f28`,
  T4 : `75cdfd8..8cd7145`, T5 : `bec2426`, T6 : `556eaf0`

## Tâche 7 — Complétée (commit `563e5b8` + `2f991d2`)
- Ingest et données; correction types géométrie nullable, mode offline, cache ZIP.
- 114 sourates exactes, 0 écart de page, 17 écarts de juz.
- Gates validés.

## Tâche 8 — Complétée (commit `92260419...`)
- `feat(ui): police KFGQPC Warsh embarquee`
- 3 fichiers : `src/styles/fonts.css`, `tests/unit/font.test.ts`, `src/main.tsx`
- 63/63 tests, `tsc --force` OK, `vite build` OK.
- TTF bundle IDENTIQUE à la source (MD5 `1417f8f6397aec787f586273a423762`).
- Revues conformité et qualité APPROUVÉES.

## Tâche 9 — Complétée (commit `67129d4`)
- `feat(sync): recherche dichotomique de l'ayah courant`
- 2 fichiers : `src/sync/timing-index.ts`, `tests/unit/timing-index.test.ts`
- 70/70 tests, `tsc --force` OK, `vite build` OK.
- Vérification différentielle indépendante : 76254 comparaisons sur 114 sourates / 6214 lignes -> 0 mismatch.
- Revue conformité APPROVÉE. Revue qualité APPROVÉE (1 MINOR non bloquant : `isMonotonic` jamais appelé en production, reporté hors périmètre).

## Tâche 10 — Implémentée (commit `bcb47d4`)
- `feat(sync): moteur de synchronisation audio / surlignage`
- 2 fichiers : `src/sync/use-sync-engine.ts`, `tests/unit/use-sync-engine.test.ts`
- 74/74 tests, `tsc --force` OK, `vite build` OK.
- **Défi du plan corrigé** : le bloc `afterEach` du plan est DÉFECTUEUX —
  `vi.useRealTimers(); vi.unstubAllGlobals();` échoue 4/4 tests avec
  `Cannot clear timer: timer created with setTimeout() but cleared with cancelAnimationFrame()`.
  L'ordre inversé (`vi.unstubAllGlobals(); vi.useRealTimers();`) passe 4/4.
  Preuve : throwaway probe dans `%TEMP%\opencode\t10-probe`.
- Commentaire ajouté à ~L26 du test expliquant le swap (déviation par rapport au plan).
- Revues CLOSES (session 2026-09-28, agents bloqués 402 -> revues faites en ligne) :
  - Conformité : `use-sync-engine.ts` OCTET POUR OCTET identique au plan ; le test ne diffère
    que par le swap `afterEach` documenté + commentaire (diff outillé `sdd/t10-diff.mjs`).
    Exactement 2 fichiers. `* 1000` respecte le contrat ms de `findAyahAt`. APPROUVÉE.
  - Qualité : APPROUVÉE avec 1 MINOR non bloquant — `callback.current = onAyah` mute un ref
    au rendu (idiome latest-callback ; callback d'un rendu descarté pourrait émettre une
    fois). Imposé par le plan, hors périmètre de correction. Reset `last.current` au cleanup
    => re-émission au remount : couvert par l'avertissement « callback idempotent » T11.

## Tâche 11 — Complétée (commit `3f611ad`)
- `feat(ui): liste d'ayat RTL, surlignage et selecteur de sourate`
- 5 fichiers : `src/state/session.ts`, `src/components/AyahItem.tsx`,
  `src/components/AyahList.tsx`, `src/components/SurahPicker.tsx`,
  `tests/unit/components.test.tsx`
- 79/79 tests, `tsc -b` OK, `vite build` OK. TDD rouge->vert constaté (5 échecs
  d'assertion métier sur stubs compilables, puis 5/5 verts).
- Les 4 fichiers d'implémentation sont OCTET POUR OCTET identiques au plan (vérifié par
  script de diff).
- **Défi du plan corrigé #2** : le test T11 du plan est DÉFECTUEUX — sa fixule est un texte
  de type Hafs qui ne contient AUCUN codepoint étendu, et le test assert `toContain("ࣰ")`
  sur cette propre fixule : échec garanti quel que soit le composant. Fix : fixule = texte
  réel de la sourate 112 de `src/data/quran-warsh.json` (revérifié octet pour octet), et
  assertion sur U+08F1 (présent dans l'ayah 4 réel). Commentaire dans le test. Le fichier
  de plan devrait être corrigé dans une future révision.
- Note : `useSession` n'a aucun test dans le plan lui-même (le test T11 ne couvre que
  AyahList/SurahPicker). Écart au plan consigné, corrigé en T12/T13 par les tests e2e.

## Tâche 12 — Complétée (commit `f6bcdbc`)
- `feat(ui): lecteur audio avec surlignage synchronise`
- 4 fichiers : `src/components/PlayerBar.tsx`, `src/App.tsx`,
  `tests/unit/player-bar.test.tsx`, `src/vite-env.d.ts` (NOUVEAU, hors liste du plan)
- 85/85 tests, `tsc -b` OK, `vite build` OK (114 chunks de timings partages, glob
  verifie : `./data/timings/120/*.json` = 114 fichiers). TDD rouge->vert constate
  (6 echecs d'assertion sur stub compilable).
- `PlayerBar.tsx` et `App.tsx` OCTET POUR OCTET identiques au plan (auto-revue inline,
  agents de revue bloques 402).
- **Ecart #3 (test)** : la fixule `timings` du plan omit `geometry` (champ rendu
  OBLIGATOIRE par 2f991d2) et laisse `precision` infere `string` -> le fichier du plan
  tel quel ne passerait pas `npm run typecheck`, gate de la tache. Corrige par
  annotation `SurahTimings` + `geometry: {}`, commentaire dans le test.
- **Ecart #4 (fichier)** : `src/vite-env.d.ts` ajoute (`/// <reference types="vite/client" />`)
  — le scaffold T1 ne l'a jamais cree ; `import.meta.glob`leve TS2339 sans lui. Le plan
  ne le mentionne nulle part : gap de plan, corrige ici.
- Note : `useSession` reste sans test unitaire direct (toujours l'ecart T11 reporte).

## Tâche 13 — Complétée (commit `f59902b`)
- `test(e2e): parcours de lecture avec audio simule` — 4 fichiers :
  `playwright.config.ts`, `tests/e2e/wav.ts`, `tests/e2e/reader.spec.ts`,
  `tsconfig.node.json`. `npx playwright install chromium` fait une fois.
- 3 fichiers écrits d'abord OCTET POUR OCTET depuis le plan, puis 3 écarts
  nécessaires pour que les gates passent (le plan tel quel échoue) :
- **Ecart #5a (config)** : `tsconfig.node.json` `lib += "DOM"`. Des que
  `tests/e2e` entre dans l'`include`, les `.d.ts` de playwright-core
  referencevent `HTMLElement`/`SVGElement` -> ~200 erreurs TS2304. Gap de plan.
- **Ecart #5b (config)** : webServer `npm run build && npm run preview -- --host
  127.0.0.1`. Sous Windows, `vite preview` seul se lie a `[::1]` uniquement ;
    l'URL d'attente `127.0.0.1:4173` ne repond jamais (curl : 000 vs 200) ->
  timeout 180 s. Gap de plan (dependant de l'OS).
- **Ecart #6 (test)** : `stubAudio` rendu **range-aware** (206 + `Content-Range`
  quand la requete porte `Range:`). Le `route.fulfill` 200 full-corps du plan
  rend l'element media NON navigable : `seekable=[0-0]`, tout
  `currentTime=N` est ramene a 0 (`seeking@0`/`seeked@0`), le test de surlignage
  echoue. Cause etablie par 4 sondes e2e jetables (`_debug*.spec.ts`, supprimees
  avant commit) : clavier trusted et assignation directe hors React echouent
  pareil -> c'est le transport, pas la fixture ni React. Le vrai serveur
  mp3quran repondant 206, le stub doit l'imiter.
- Resultat : `npm run e2e` -> **3 passed (16.5 s)**, sans reseau externe (tout
  `**/*.mp3` est stubbe ; seul `127.0.0.1:4173` est touche).

## Critères de fin du plan socle (vérifiés 2026-09-28)
- [x] `npm test` 85/85 (13 fichiers) ; `npm run typecheck` OK ; `npm run build`
  produit `dist/` (warning chunks >500 kB connu, hors perimetre) ; `npm run e2e` 3/3.
- [x] `src/data/ingest-report.json` : `corroboration.pages.diffs = 0` ;
  `corroboration.juz.total = 17` (lus, non recalcules).
- [x] `npm run ingest` **idempotent** : execute deux fois de suite, `git status`
  ne montre aucun fichier de donnees modifie (seuls les 4 fichiers T13, commites).
- [x] `font-display: swap` present a la ligne 6 de `src/styles/fonts.css` et dans
  `dist/assets/index-*.css` buildee ; console e2e sans warning ni erreur (sonde).
  Note : le TTF est embarque par le build (non par le reseau) — `@font-face` +
  swap restent la garantie demandee ; nuance consignee ici.
- [x] Sourates affichees + codepoints etendus dans le DOM (sonde e2e jetable
  `_endcriteria.spec.ts`, supprimee apres releve) : comptes `.ayah` reels —
  sourate 1 : **7**, 36 : **82**, 112 : **4** (2 : 285, 27 : 95). Codepoints :
  1/36/112 n'en portent que 9 des 14 ; **U+0873/0876/0879/0887/08C9** sont
  absents de ces trois sourates (U+08C9 n'existe que dans la sourate 27 du
  corpus). Union {1,2,27,36,112} = **14/14 presents dans le DOM**. Le critere
  « les 14 dans le DOM » est donc satisfait par le corpus, pas par 112 seule
  (le test unitaire T11 `conserve les codepoints etendus` couvre le texte reel
  de 112, pas les 14).

## Où reprendre (2026-09-28 — HEAD = `f59902b`, socle 14/14, arbre propre hors `sdd/`)
- **T0–T13 : FAITES et COMMITÉES.** Les 14 tâches du plan socle sont closes et
  tous ses critères de fin sont vérifiés (section ci-dessus).
- **Nouvelle direction validée par le user (2026-09-28) : lecture « un fichier
  audio par verset » en EXCLUSIF** (everyayah.com riwaya Warsh, `NNNMMM.mp3`,
  6214 fichiers), ordonnancement **Web Audio** à relais (blanc = 0 échantillon
  près, pré-décodage profondeur 1), téléchargement dans l'app par **sourate et
  par juz** (Cache Storage), surlignage + **figeage au centre** du verset actif,
  bouton **répéter** (hifz). Récitant par défaut : `warsh_Abdul_Basit_128kbps`.
- Plan d'exécution et décisions fermés dans
  `C:\Users\sadeq\.claude\plans\synchronous-gathering-teapot.md` (Phase B) ; le
  consigner en plan SDD `docs/superpowers/plans/2026-09-28-coran-par-verset.md`
  (tasks T-A..T-F) AVANT d'écrire du code, puis TDD task par task.
- Faits à réutiliser : URL `https://everyayah.com/data/warsh/warsh_Abdul_Basit_128kbps/NNNMMM.mp3`
  — vérifiée : 6214 fichiers, 200 `audio/mpeg`, `Accept-Ranges: bytes`,
  CORS `*` avec `Range` autorisé. Corpus 2 668 min ≈ 2,44 Go en 128k, ~402 Ko
  par verset en moyenne. `fetch`+`decodeAudioData` lit le fichier entier : la
  classe de bug écart #6 (Range/seekable) disparaît du design par-verset.
- Ce qui sera supprimé/réécrit : `src/sync/*` (findAyahAt/useSyncEngine),
  `PlayerBar.tsx` + tests unitaires associés, `reader.spec.ts` (mode entière).
- Risques consignés pour le plan par-verset : basmala en têtes du verset 1 chez
  certains récitateurs everyayah (vérifier à l'écoute, ne pas compenser à
  l'aveugle) ; clic éventuel de `ctx.suspend()` ; durées `timings/120` ≠ Abdul
  Basit (estimation seulement) ; quota Cache Storage (~2,4 Go si tout).
- Le script de diff plan-vs-committé réutilisable est dans `sdd/t10-diff.mjs` (adaptable).

## Dettes et notes reportées
- `isMonotonic` (existant, testé en T5) jamais appelé en production. `findAyahAt` suppose des rows tries par startTime. Correctif dans `scripts/ingest.mjs` ou `scripts/lib/timings.mjs`. Reporté hors périmètre.
- Défi plan T10 : le `afterEach` du plan est cassé. Le fichier de plan devrait être corrigé dans une future révision.
- T11 : Attention — un `timings?.ayat` selector retournant une NEUVE liste à chaque rendu déclenche le cleanup+rebuild de `useSyncEngine`, ce qui ré-émet l'ayah courant. Le callback doit être idempotent.
- T12 : `NO_ROWS` stable est nécessaire car `useSyncEngine` liste `rows` dans ses dépendances.
- T12 : `import.meta.glob` dans `App.tsx` pour découvrir les 114 fichiers de timings à la compilation.
- T13 : WAV silencieux généré en mémoire (Buffer), pas de binaire commité, pas de réseau externe.
- T13 (leçon media) : Chromium négocie des requêtes `Range:` dès qu'on seek sur un
  `src` media. Tout stub `route.fulfill` doit réponde 206+`Content-Range` sous
  peine de `seekable=[0-0]` (snap-back du seek, aucune erreur levee). Ne sert plus
  en mode par-verset (fetch lit le fichier entier) mais vital si un futur mode
  garde du streaming.
- T13 : `vite preview` se lie a `[::1]` sous Windows ; `--host 127.0.0.1` est
  necessaire au webServer Playwright dont l'URL d'attente est IPv4.
