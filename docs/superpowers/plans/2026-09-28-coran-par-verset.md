# Plan 2 — Lecture par verset : ordonnanceur Web Audio sans blanc, cache téléchargeable

> **Source de vérité** : plan approuvé `C:\Users\sadeq\.claude\plans\synchronous-gathering-teapot.md` (Phase B)
> **Prérequis** : Plan 1 (socle) clos 14/14, HEAD `f59902b`, gates verts.
> **Statut** : à exécuter. Direction **exclusive** validée par le user (2026-09-28) : le mode
> « fichier audio par verset » **remplace** le mode « sourate entière » ; aucun mode hybride.

---

## Pourquoi ce plan

Le socle lit un mp3 par sourate (`mp3quran.net/…/NNN.mp3`) et synchronise le surlignage par
recherche binaire temps→verset (`src/sync/`). Cette synchro est une estimation calée sur les
durées du fichier entier. La nouvelle approche prend un fichier mp3 **par verset**
(`everyayah.com/data/warsh/<reciter>/NNNMMM.mp3`) : le verset actif est connu **par
construction** (chaque piste EST un verset), la recherche binaire devient inutile, et le
blanc entre deux versets est éliminé par ordonnancement **Web Audio** : une seule horloge
`AudioContext`, un `playhead` chaîné, `next.start(playhead) === prev.start + prev.duration`
à l'échantillon près. L'algo voulu par le user — « 2 agents qui se relaient en lecture
séquentielle avec préchargement de la cartouche audio » — est la boucle
lecture/pré-décodage profondeur 1 décrite en T-C.

## Faits vérifiés (2026-09-28, sondes live — pas des suppositions)

- URL : `https://everyayah.com/data/warsh/<dir>/NNNMMM.mp3`, padding **3+3**
  (`2:255`→`002255`, `112:1`→`112001`). HEAD `112001.mp3` → **200 `audio/mpeg`**,
  `Accept-Ranges: bytes`, `Access-Control-Allow-Origin: *`.
- Dossiers Warsh existants (HEAD 200 chacun sur `112001.mp3`) :
  `warsh_Abdul_Basit_128kbps`, `warsh_ibrahim_aldosary_128kbps`,
  `warsh_yassin_al_jazaery_64kbps`. **Récitant par défaut validé : Abdul Basit 128 kbps.**
- Couverture : dossier Abdul Basit = **6214 mp3** = nombre d'ayat du projet.
- Corpus : 2 668 min ≈ **2,44 Go** en 128k, **~402 Ko/verset** en moyenne (verset ≈ 26 s).
  Décodé Float32 44,1 kHz ≈ 9,2 Mo/verset → fenêtre de pré-décodage **profondeur 1**
  (pic ≈ 18 Mo).
- `fetch` + `decodeAudioData` lit le fichier **entier** : plus de `Range`, plus de
  `seekable=[0-0]` — la classe de bug écart #6 du socle disparaît du design.
- juz : `src/data/quran-warsh.json`, ligne `a[i] = [juz, page, texte]` (`types.ts::AyahRow`) ;
  30 juz, « télécharger le juz J » = tous les `(s,a)` avec `row[0]===J`, sans second ingest.
- `meta.json` est **régénéré** par `npm run ingest` (`scripts/ingest.mjs:405`, champ
  `reciters: RECITERS` à la ligne 423) : déclarer les récitants par-verset dans
  `scripts/lib/manifest.mjs` et ajouter le champ `ayahReciters` suffit ; régénérer ensuite.
- `useSession` (`src/state/session.ts`) : aucun persistant → changer la sémantique de
  `state.reciter` (moshaf 120 → récitant par-verset 1..3) est sans coût de migration.
- Aucun service worker ni Cache Storage dans le socle (grep vide, `public/` absent) :
  le magasin audio est un composant **à créer**.
- `127.0.0.1` est un origine « trusted » Chromium → contexte sécurisé → Cache Storage
  disponible sous `vite preview`. À confirmer au premier run e2e (T-F) ; sinon basculer
  l'URL e2e sur `http://localhost:4173` (également trusted) — note de repli, pas un blocage.

## Décisions verrouillées (user, AskUserQuestion 2026-09-28)

1. Ordonnancement **Web Audio** (blanc 0 échantillon près), pas de blob-relay.
2. Récitant par défaut `warsh_Abdul_Basit_128kbps`.
3. Granularité de téléchargement v1 : **sourate ET juz** (boutons explicites uniquement ;
   **aucun** préchargement automatique du corpus — la fenêtre d'écoute est profondeur 1).
4. Le mode par-verset est **exclusif** : `src/sync/` est supprimé en T-D.

## Structure de fichiers cible

```
coran/
├── scripts/lib/manifest.mjs          # MODIFIÉ T-A : EVERYAYAH_BASE, AYAH_RECITERS, selectAyahReciter
├── scripts/ingest.mjs                # MODIFIÉ T-A : champ ayahReciters dans meta.json
├── src/
│   ├── audio/                        # NOUVEAU paquet (4 fichiers)
│   │   ├── ayah-source.ts            # T-A  ayahUrl(reciter,surah,ayah,count) + pad3 + bornes
│   │   ├── audio-store.ts            # T-B  Cache Storage (octets mp3) + listUnit + downloadUnit
│   │   ├── ayah-scheduler.ts         # T-C  ordonnanceur à relais playhead, gap 0, pur (ctx injecté)
│   │   └── use-ayah-player.ts        # T-D  hook React : AudioContext réel, memo décodage, contrôles
│   ├── components/
│   │   ├── PlayerBar.tsx             # T-D  RÉÉCRIT : navigateur de versets + récitants + repeat
│   │   ├── DownloadPanel.tsx         # T-D  NOUVEAU : boutons sourate/juz + progression
│   │   ├── AyahItem.tsx              # T-E  scrollIntoView({block:"center"}) quand actif+suivi
│   │   └── AyahList.tsx              # T-E  interrupteur « suivre/centrer »
│   ├── sync/                         # SUPPRIMÉ T-D (use-sync-engine.ts, timing-index.ts)
│   ├── types.ts                      # T-A  interface AyahReciter ; T-D ajustements
│   ├── state/session.ts              # T-D  reciter: 1..3 (sémantique par-verset), playing retiré
│   └── App.tsx                       # T-D  recâblage : player, timings 120 = durées de référence
├── src/data/meta.json                # T-A  régénéré (ayahReciters)
├── tests/unit/
│   ├── ayah-source.test.ts           # T-A  (env node)
│   ├── audio-store.test.ts           # T-B  (jsdom, caches/fetch bouchonnés)
│   ├── ayah-scheduler.test.ts        # T-C  (env node, faux ctx enregistreur)
│   ├── player-bar.test.tsx           # T-D  RÉÉCRIT (jsdom)
│   ├── components.test.tsx           # T-E  ajusté (bouchon scrollIntoView)
│   ├── ayah-centering.test.tsx       # T-E  NOUVEAU (jsdom)
│   ├── timing-index.test.ts          # SUPPRIMÉ T-D
│   └── use-sync-engine.test.ts       # SUPPRIMÉ T-D
└── tests/e2e/
    ├── reader.spec.ts                # T-F  RÉÉCRIT : stubs 200 full-body par verset
    └── wav.ts                        # conservé (silentWav), durées courtes par verset
```

## Invariants figés

1. **Gap 0** : pour deux pistes consécutives, `next.startAt === prev.startAt + prev.duration`
   (test unitaire T-C, égalité exacte avec le faux ctx).
2. **Un verset = une piste = un index** : jamais de calcul ms→index ; l'index courant appartient
   à `[0, ayahCount)`.
3. **Padding URL** : `pad3` strict sur sourate ET verset ; `ayah=0`, `ayah>count`,
   `surah∉[1,114]` lèvent.
4. **Cache d'abord** : `getAyahBytes` consulte `caches.match` avant tout `fetch` ; tout verset
   joué est mis en cache ; un échec de `cache.put` (quota) ne casse **pas** la lecture.
5. **Concurrence bornée** : `downloadUnit` a ≤ 4 requêtes en vol (test T-B).
6. **Idempotence** : relancer `downloadUnit` sur une unité déjà en cache → 0 `fetch`.
7. **Durées = estimation** : `timings/120/*.json` ne sert plus qu'à la progression/poids
   estimés ; la durée réelle d'un verset est `buffer.duration`. Badge libellé
   « durées estimées ».
8. **Geste utilisateur** : l'`AudioContext` est créé/`resume()` dans le handler du clic Lire.
9. Discipline du socle conservée : commit ASCII par tâche, message
   `Co-Authored-By: Claude Code <noreply@anthropic.com>`, gates `npm test` +
   `npm run typecheck` + `npm run build` à chaque tâche, `npm run e2e` en T-F, jamais de
   `git stash` nu.

---

## Tâche T-A — URL par verset et récitants everyayah

**Fichiers** : modifie `scripts/lib/manifest.mjs`, `scripts/ingest.mjs`, `src/types.ts`,
`src/data/meta.json` (régénéré) ; crée `src/audio/ayah-source.ts`,
`tests/unit/ayah-source.test.ts`.

**Rouge d'abord** (`tests/unit/ayah-source.test.ts`, env node, `import { ayahUrl, pad3 }`) :
1. `pad3(1)==="001"`, `pad3(255)==="255"`, `pad3(1000)` lève.
2. `ayahUrl(abdulBasit, 112, 1, 4) === "https://everyayah.com/data/warsh/warsh_Abdul_Basit_128kbps/112001.mp3"`.
3. `ayahUrl(abdulBasit, 2, 255, 286)` finit par `002255.mp3` (padding 3+3).
4. Bornes : `ayah 0`, `ayah 5` avec `count=4`, `surah 115` → `RangeError` (message français).
5. Le manifeste exported `AYAH_RECITERS` : 3 entrées, ids uniques, exactement une
   `priority === 0` = dossier `warsh_Abdul_Basit_128kbps` ; `selectAyahReciter(raw)`
   (chaîne → entrée, inconnu → `Error`, vide → défaut), symétrique de `selectReciter`.

**Vert** :
- `manifest.mjs` : `EVERYAYAH_BASE = "https://everyayah.com/data/warsh"` ;
  `AYAH_RECITERS = Object.freeze([ {id:1, dir:"warsh_Abdul_Basit_128kbps", bitrate:128,
  label:"Abdul Basit — Warsh 128kbps", labelFr:"Abdul Basit (Warsh, 128 kbps)", priority:0},
  {id:2, dir:"warsh_ibrahim_aldosary_128kbps", bitrate:128, …, priority:1},
  {id:3, dir:"warsh_yassin_al_jazaery_64kbps", bitrate:64, …, priority:2} ])` ;
  `selectAyahReciter`. Commentaire : dirs vérifiés HEAD 200 le 2026-09-28.
- `types.ts` : `interface AyahReciter { id:number; dir:string; bitrate:number; label:string;
  labelFr:string; priority:number }`.
- `ingest.mjs` : `meta.json` += `ayahReciters: AYAH_RECITERS` (import depuis le manifeste).
  `npm run ingest` (deux fois → idempotence vérifiée par `git status`).
- `src/audio/ayah-source.ts` : `pad3`, `ayahUrl(r: AyahReciter, surah, ayah, ayahCount): string`.

**Commit** : `feat(audio): url par verset et recitants everyayah`

## Tâche T-B — Magasin audio (Cache Storage, téléchargement sourate/juz)

**Fichiers** : crée `src/audio/audio-store.ts`, `tests/unit/audio-store.test.ts`.

**Contrat** (octets uniquement — le décodage `AudioBuffer` appartient au hook T-D, pour que
le store reste testable sans `AudioContext`) :
- `CACHE_NAME = "coran-warsh-ayah-v1"` ; `openCache()` encapsule `caches.open`.
- `getAyahBytes(url): Promise<ArrayBuffer>` — cache hit → `response.arrayBuffer()` ;
  miss → `fetch` (non-ok → `Error`), `cache.put` **tenté mais non bloquant** (quota/`SecurityError`
  attrapés), retourne les octets.
- `listAyats(quran, unit): {surah,ayah}[]` — `unit = {kind:"surah",n} | {kind:"juz",j}` ;
  juz = tous les `(s,a)` avec `row[0]===j`, triés par (s,a) ; sourate = `a` entier de la ligne.
- `downloadUnit(unit, reciter, quran, {concurrency=4, onProgress, isAborted?})` :
  construit les URL via `ayahUrl`, **saute** celles déjà en cache (idempotent), file à
  concurrence bornée, `onProgress({done,total})` à chaque fin, retourne
  `{fetched, skipped, bytes}`.

**Rouge d'abord** (jsdom via `@vitest-environment jsdom` ; jsdom n'implémente **pas**
Cache Storage → fake `caches` maison + `vi.stubGlobal("fetch", …)` compteur) :
1. `listAyats` sourate 112 → 4 entrées `(112,1..4)` ; sourate 1 → 7 ;
   un juz donné (ex. 30) → tous les rows `row[0]===30`, ordre (s,a).
2. `downloadUnit({surah 112})` met **exactement** `112001..112004.mp3` en cache (URLs
   complètes assertées) et `onProgress` final `{done:4,total:4}`.
3. Second appel → `fetched:0, skipped:4`, **0** appel `fetch` (idempotence).
4. Concurrence : fetch stub à résolution différée → jamais > 4 en vol (pic mesuré).
5. `getAyahBytes` : hit cache → pas de fetch ; miss → fetch + put ; échec de `put`
   (stub qui throw) → l'`ArrayBuffer` est quand même retourné.

**Commit** : `feat(audio): magasin cache storage et telechargement sourate/juz`

## Tâche T-C — Ordonnanceur à relais (cœur gap 0)

**Fichiers** : crée `src/audio/ayah-scheduler.ts`, `tests/unit/ayah-scheduler.test.ts`
(env node — pur, `AudioContextLike` injecté).

**Contrat** :
```ts
interface AudioBufferLike { duration: number }
interface BufferSourceLike {
  buffer: AudioBufferLike | null;
  connect(dest: unknown): void; disconnect(): void;
  start(when?: number): void; stop(when?: number): void;
  onended: (() => void) | null;
}
interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  createBufferSource(): BufferSourceLike;
  suspend(): Promise<void>; resume(): Promise<void>;
}
interface AyahRef { surah: number; ayah: number }
createAyahScheduler({ ctx, getDecoded, ayat, prefetchDepth = 1,
  onAyahChange?(index), onDone?, onPlayingChange?(bool) }): {
  play(): Promise<void>; pause(): Promise<void>; toggle(): Promise<void>;
  seekIndex(i: number): Promise<void>; step(delta: number): Promise<void>;
  setRepeat(on: boolean): void; getRepeating(): boolean;
  readonly index: number; readonly playing: boolean; destroy(): void;
}
```
Boucle interne : `scheduleFrom(i)` → `onAyahChange(i)` → `buf = await memo(i)`
(memo = `getDecoded(ayat[i])` mis en cache-promise, fenêtre `prefetchDepth`, éviction après
lecture) → `src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
src.start(playhead)` → `playhead += buf.duration` → amorcer `memo(i+prefetchDepth)` →
`src.onended` → si `playing` et `i === index` : `scheduleFrom(repeat ? i : i+1)` ; fin de
liste (sans repeat) → `onDone()`, `playing = false`. `pause`/`play` = `ctx.suspend()` /
`ctx.resume()`. `seekIndex` : `ctx.suspend()`, stopper les sources en vol,
`playhead = ctx.currentTime`, `scheduleFrom(i)`, `ctx.resume()`. `step` borne à
`[0, len)` ; `destroy` stoppe et déconnecte, invalide la génération (les `onended` tardifs
ne redéclenchent rien — flag `token` incrémenté à chaque seek/destroy).

**Rouge d'abord** (faux ctx qui enregistre `start(when)`, `onended` déclenché à la main,
buffers 1.0/1.5/2.0/0.5 s) :
1. **Gap 0** : en jouant 4 ayat, chaque `startAt === startAt_prev + duration_prev`
   (assertion d'égalité exacte, chaîne complète).
2. **Séquence** : `onAyahChange` reçus `0,1,2,3`, puis `onDone` appelé une fois et
   `playing === false`, plus aucun `createBufferSource` après le 4e.
3. **Relais pré-décodé** : `getDecoded(1)` a été appelé **avant** qu'on déclenche
   `onended(0)` (preuve que la cartouche suivante est prête — profondeur 1).
4. **Pause/reprise** : `pause()` → `ctx.suspend()` appelé, `playing false` ;
   `play()` → `ctx.resume()`, `onended` du verset courant reprend la chaîne.
5. **seekIndex(2)** pendant le 0 : les sources en vol sont `stop()`-ées,
   nouveau `playhead = ctx.currentTime`, la suite jouée est `2,3`.
6. **Repeat** : `setRepeat(true)` avant la fin → après `onended(3)`, re-joue l'index 3,
   `onDone` **jamais** appelé ; puis `setRepeat(false)` → avance et finit.
7. **step** : `step(+1)`/`step(-1)` naînés aux bornes (clamp) ; `play()` deux fois = no-op ;
   `destroy()` → plus aucun appel après un `onended` tardif.

**Commit** : `feat(audio): ordonnanceur web audio a relais sans blanc`

## Tâche T-D — Hook, PlayerBar navigateur de versets, suppression de src/sync

**Fichiers** : crée `src/audio/use-ayah-player.ts`, `src/components/DownloadPanel.tsx`,
`tests/unit/use-ayah-player.test.tsx` ; réécrit `src/components/PlayerBar.tsx`,
`src/App.tsx`, `src/state/session.ts`, `tests/unit/player-bar.test.tsx` ; **supprime**
`src/sync/`, `tests/unit/timing-index.test.ts`, `tests/unit/use-sync-engine.test.ts`.

**`use-ayah-player`** : `useAyahPlayer({ reciter, surah, ayahCount, onAyah })` — crée
l'`AudioContext` **au premier geste** (lazy, dans `play` ; `window.AudioContext ??
window.webkitAudioContext`, factory injectable pour le test) ; `getDecoded = async (ref) =>
ctx.decodeAudioData(await getAyahBytes(ayahUrl(...)))` ; reconstruit le scheduler quand
`(reciter, surah)` change (destroy propre). Expose `{ playing, index, repeat, play, pause,
toggle, next, prev, seekAyah(1-based), setRepeat }`. `onAyah(index)` remonté au parent.

**`PlayerBar`** (réécrit, plus de `<audio>`, plus de `player-seek` en secondes) :
- `select data-testid="player-reciter"` (listé depuis `meta.ayahReciters`, valeur = id).
- `button data-testid="player-play"` (aria-label « Lire »/« Pause »),
  `player-prev`, `player-next`, `player-repeat` (`aria-pressed`).
- `div data-testid="player-position"` texte `« N / total »` (1-based).
- `div data-testid="player-progress"` (`role="progressbar"`,
  `aria-valuenow` = `%` estimé = `sum(durées 1..N-1)+t_est / sum(durées)` sur
  `timings/120/${surah}.json`, **estimation** uniquement).
- badge `.badge` « durées estimées » quand `timings` présent et `precision !== "exact"`
  (convention socle conservée pour le test à deux branches).
- Clic sur un verset de la liste (`onSelect` App) → `seekAyah` (lit depuis ce verset si
  en lecture, sinon positionne).

**`DownloadPanel`** : boutons `download-surah` / `download-juz` (juz affiché = `row[0]` du
verset actif ou du premier verset), `progress data-testid="download-progress"`
(`aria-valuemin/max/now`, texte `{done}/{total} · ≈{Mo}` — Mo = `durations_ms × bitrate/8`
depuis timings 120), branché sur `downloadUnit` + `onProgress`. Erreur réseau → message,
pas de crash.

**`session.ts`** : `reciter: 1` par défaut (défaut everyayah), champ `playing` retiré
(c'est le hook qui le détient). `types.ts` : `meta` côté app += `ayahReciters`.

**Rouge d'abord** (`player-bar.test.tsx` jsdom, `AudioContext`/`caches`/`fetch` bouchonnés
via factory injectée et `vi.stubGlobal`) :
1. rendu 112 → position `« 1 / 4 »` (ou « — » avant premier jeu, tranché au rouge),
   sélecteur avec les 3 récitants, Abdul Basit sélectionné par défaut.
2. clic play → `onAyah(…)`/`data-active` propagé ; clic next → `2` ; prev → `1`.
3. repeat → `aria-pressed="true"` et le même verset rejoué (via faux ctx gap-0 de T-C).
4. badge : branches exact/non-exact conservées (fixture `SurahTimings` annotée avec
   `geometry`, écart #3 du socle).
5. `use-ayah-player.test.tsx` : `ctx` créé au premier `play()` (pas au rendu — politique
   autoplay) ; changement de `surah` → `destroy` du scheduler précédent.

**Commit** : `feat(audio): lecteur par verset et panneau de telechargement`

## Tâche T-E — Figeage au centre et suivi

**Fichiers** : modifie `src/components/AyahItem.tsx`, `src/components/AyahList.tsx`,
crée `tests/unit/ayah-centering.test.tsx`, ajuste `tests/unit/components.test.tsx`.

**Contrat** : `AyahItem` tient une `ref` ; `useEffect` sur `active && follow` →
`ref.current.scrollIntoView({ block: "center", behavior: "smooth" })`. `AyahList` porte
l'interrupteur `button data-testid="follow-toggle"` (`aria-pressed`, libellé « Suivre le
verset », défaut **activé**) — coupé, aucun scroll automatique (l'utilisateur qui parcourt
n'est pas téléguidé). `onSelect` (tap verset) reste inchangé.

**Rouge d'abord** (jsdom ; `Element.prototype.scrollIntoView = vi.fn()` dans
`tests/setup.ts` ou en tête de test) :
1. verset rendu actif → `scrollIntoView` appelé avec `{block:"center",behavior:"smooth"}`.
2. passer de actif à inactif → pas de nouvel appel.
3. `follow` coupé puis verset actif → **0** appel ; réactivé + verset actif → 1 appel.
4. `components.test.tsx` existant : ajouter le stub `scrollIntoView` (sinon `TypeError`
   jsdom) sans toucher ses assertions métier.

**Commit** : `feat(ui): verset actif fige au centre avec suivi desactive`

## Tâche T-F — e2e réécrit (Web Audio réel, stubs 200, cache hors-ligne)

**Fichiers** : réécrit `tests/e2e/reader.spec.ts` ; `tests/e2e/wav.ts` conservé.

**Stub** : `page.route("**/*.mp3")` → WAV silencieux court **en 200 full-body** (plus de
Range : `fetch` lit tout ; écart #6 caduc — le dire dans un commentaire). Durées
distinctes et courtes (ex. 0,4 s) pour que la chaîne d'enchaînement aille vite ; clé =
nom de fichier `NNNMMM` pour retrouver le verset.

**Assertions** :
1. Sourate 112 : `toHaveCount(4)` `.ayah`, `dir="rtl"` (récriture des tests socle 1 et 3).
2. Clic `player-play` → `ayah-1` `data-active="true"`, puis **avance automatiquement**
   jusqu'à `ayah-4` (`await expect` avec timeout) et le lecteur s'arrête (`player-play`
   redevient « Lire »).
3. **Centrage** : sourate 2 (82+ versets affichés), `player-next` × 39 (ou seek vers 40) →
   `ayah-40` `data-active` et sa `boundingBox()` à ±90 px de la moitié de la hauteur du
   viewport.
4. **Repeat** : sur 112, activer `player-repeat`, jouer jusqu'à la fin, vérifier que
   `ayah-4` redevient actif (la chaîne repart) et ne s'arrête pas de lui-même sous ~2 s.
5. **Hors-ligne / cache** : 112 joué une fois (cache rempli via `cache.put`), puis
   `page.route("**/*.mp3", r => r.abort())` + `page.reload()` + play → la lecture **avance
   quand même** (assertion `data-active` 1→2) et le réseau mp3 est resté à 0 requêtes
   réussies (compteur via `page.on("requestfinished")`). Si Cache Storage indisponible sur
   `127.0.0.1` (peu probable — origine trusted), basculer `baseURL`/webServer sur
   `http://localhost:4173` (même port, écart #5b conservé côté `--host`).
6. Badge « durées estimées » branches exact/autre (fixture timings 7 réels du repo).

**Gates finaux** : `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e` — tout
vert, e2e sans réseau externe (seuls `127.0.0.1` touchés).

**Commit** : `test(e2e): lecture par verset sans blanc et cache hors-ligne`

---

## Critères de fin du plan

- [ ] Gap 0 prouvé unitairement (T-C assertion 1) et enchaînement automatique prouvé e2e (T-F 2).
- [ ] 3 récitants Warsh par-verset fonctionnels, défaut Abdul Basit 128k, tous les mp3 du
  projet adressables (padding vérifié en test + 1 HEAD live en T-A).
- [ ] Téléchargement par sourate et par juz, idempotent, ≤ 4 en vol, progression affichée ;
  rejeu hors-ligne prouvé (T-F 5).
- [ ] `src/sync/` supprimé, plus aucune référence (`grep -rn "use-sync-engine\|timing-index\|findAyahAt" src tests` vide).
- [ ] Verset actif surligné **et figé au centre**, interrupteur de suivi respecté.
- [ ] `timings/120` conservés comme estimation seule ; `audioUrl` des timings jamais lu.
- [ ] Gates complets verts ; `npm run ingest` toujours idempotent (champ `ayahReciters`
  déterministe).
- [ ] Vérification à l'écoute de la **basmala** (risque B7) consignée dans `sdd/progress.md` :
  écouter 001001, 002001, 112001 via l'app ; si le verset 1 est précédé de la basmala,
  **documenter** (et seulement là, décider d'une règle) — aucune compensation codée à l'aveugle.

## Risques portés (répétés ici pour qu'ils vivent dans le plan)

- Basmala en tête des fichiers du verset 1 chez certains récitateurs everyayah → écoute pilote, pas de code aveugle.
- Clic de coupure possible sur `ctx.suspend()` selon la sortie → si audible en e2e/écoute,
  repli stop+offset par source (l'API scheduler ne change pas).
- Quota Cache Storage (~2,4 Go corpus entier) → `put` non bloquant (T-B), granularité
  sourate/juz explicite.
- Durées everyayah ≠ mp3quran → progression explicitement « estimée » partout.

## Suite (hors périmètre)

Le plan 2 clos : rattraper les plans 3–4 du design (page coranique SVG, recherche/signets,
i18n/PWA), et éventuellement un mode « moshaf complet » qui ne serait plus qu'un
`downloadUnit` global par juz. Aucun de ces sujets n'entre ici.
