# Design - Lecture par verset en Warsh et en Hafs (deux corpus, deux listes de recitants)

Date : 2026-10-04
Branche : `feat/socle-warsh`
Plan : `docs/superpowers/plans/2026-09-28-coran-par-verset.md` (dont ce document est la suite)

## 1. Objectif

L'application lit le Coran verset par verset. Elle ne propose aujourd'hui qu'une seule
lecture : **Warsh 'an Nafi**, avec trois recitants. Deux de ces trois recitants ne sont
pas alignes sur le texte affiche : a partir du premier ecoute, la surbrillance et le
son sont decales d'un verset. Le changement de recitant rend le decalage visible,
mais n'en est pas la cause.

On remplace donc ce montage par deux lectures **completement cloisonnees** :

- **Warsh** : son texte, ses recitants alignes.
- **Hafs** : son texte (Hafs 'an 'Asim), ses recitants alignes.

Le mode se choisit dans la barre de lecture. Changer de mode ne peut pas produire de
decalage : texte et audio viennent du meme corpus, donc du meme decoupage en versets.

## 2. Faits verifies (mesures, pas hypotheses)

Toutes les valeurs ci-dessous ont ete mesurees sur les serveurs reels.

### 2.1 Le decalage existe des le premier ecoute

`announce(i)` fait simultanement `indexRef.current = i` et `onAyah(i + 1)`.
La surbrillance suit `index`, l'audio suit l'URL construite depuis l'index annonce.
« Surbrillance sur N, audio sur N-1 » n'est donc pas representable dans le chemin de
reprise : aucun correctif de logique ne peut le reparer. Le defaut est dans la
correspondance des donnees, pas dans le minutage.

### 2.2 Le decalage vient des fichiers audio, pas du texte

Comptage des fichiers `everyayah` sur les 114 sourates (`audit-versets.json`) :

| Recitant (dossier everyayah) | Versets | Sourates divergentes |
| --- | --- | --- |
| `warsh_Abdul_Basit_128kbps` | 6214 | 1 / 114 (sourate 26 : 226 -> 227) |
| `warsh_ibrahim_aldosary_128kbps` | 6262 | 32 / 114 |
| `warsh_yassin_al_jazaery_64kbps` | 6214 | 32 / 114 |

82 sourates sur 114 sont propres pour les trois. Les 32 sourates divergentes le sont
**de la meme facon** (memes decalages +1 a +5) pour Dosari et Jazaery : leurs dossiers
`warsh/` sont defectueux, pas « une autre lecture ».

### 2.3 Le corpus Warsh de l'application vaut 6214, Hafs vaut 6236

`src/data/quran-warsh.json` : 6214 versets, sourate 2 = 285 versets.
`https://api.quran.com/api/v4/chapters` (`verses_count`) : 6236 versets, sourate 2 = 286.

Difference : **+22 versets**. Repartie sur 50 sourates :

| Ecart (Hafs - Warsh) | Nombre de sourates |
| --- | --- |
| +1 | 22 |
| +2 | 6 |
| +3 | 3 |
| +5 | 1 |
| -1 | 11 |
| -2 | 6 |
| -3 | 1 |

**64 sourates sur 114 ont exactement le meme compte dans les deux corpus.** Ce chiffre
commande la conception (section 6).

### 2.4 Les sept recitants Hafs demandes sont tous alignes

Comptage sur les 114 sourates (`hafs-reciters-audit.json`), huit candidats testes :

| Dossier | Versets | Sourahs divergentes |
| --- | --- | --- |
| `Husary_128kbps` | 6236 | 0 |
| `Minshawy_Murattal_128kbps` | 6236 | 0 |
| `Mohammad_al_Tablaway_128kbps` | 6236 | 0 |
| `Abdul_Basit_Murattal_192kbps` | 6236 | 0 |
| `Hani_Rifai_192kbps` | 6236 | 0 |
| `Abdurrahmaan_As-Sudais_192kbps` | 6236 | 0 |
| `Yasser_Ad-Dussary_128kbps` | 6236 | 0 |
| `Muhammad_Ayyoub_128kbps` | 6236 | 0 |

Les sept retenus sont a 6236 versets et **zero divergence sur 114 sourates**. Al-Dosari
apparait via `Yasser_Ad-Dussary_128kbps` : c'est le meme recitant que
`warsh_ibrahim_aldosary_128kbps`, mais son dossier **Hafs** (racine du site, hors
prefixe `warsh/`) est exact. Les 26 versets en trop etaient dans le dossier `warsh/`.

### 2.5 Le texte Hafs vient d'api.quran.com

`GET /api/v4/verses/by_chapter/{n}?fields=text_uthmani&page_numbers=true&juz_numbers=true`
renvoie `text_uthmani`, `page_number` et `juz_number` par verset. Meme forme de ligne que
le corpus Warsh (`[juz, page, texte]`), donc meme code de rendu.

### 2.6 La typographie : QCF2001 est inexploitable pour ce texte

`QCF2001.ttf` (KFGQPC Hafs) a ete compare au corpus uthmani d'api.quran.com
(6236 versets, **70 codepoints distincts**, 69 hors espaces ignorables).

| Police | Glyphe | Couvre le corpus |
| --- | --- | --- |
| `QCF2001.ttf` | 373 | **0 / 69** |
| `AmiriQuran-Regular.ttf` | 266 | **69 / 69** |

Les trois sous-tables `cmap` de QCF2001 (`(0,3)`, `(1,0)`, `(3,1)`) sont verifiees : le
resultat ne vient pas d'un mauvais choix de sous-table. Ses glyphes vivent dans le
**codepage prive du complexe du Roi Fahd** :

```
U+F777..U+F8A6 (304)   U+FB50 (1)   U+FC41..U+FC64 (36)   U+FD5A..U+FD79 (32)
```

Le texte d'api.quran.com est en Unicode standard `U+0600..U+06FF`. Les deux ensembles
sont disjoints. C'est aussi pourquoi l'application fonctionne aujourd'hui :
`kfgqpc_warsh_v30.json` est encode dans ce codepage prive, que la police Warsh decode
exactement.

**Decision : la pile Hafs est `Amiri Quran` seule** (60 Ko en woff2). QCF2001 est
abandonne : il ne rend aucun des 69 glyphes du texte.

## 3. Decisions verrouillees (user)

1. **Texte Hafs** : api.quran.com, uthmani, 6236 versets, avec `juz` et `page` par verset.
2. **Recitants Hafs** : Al-Husary, Ibrahim Al-Dosari, Al-Minshawi (Murattal),
   Muhammad al-Tablaway, Abdurrahmaan As-Sudais, Hani Rifai, Abdul Baasit.
3. **Warsh** : `warsh_Abdul_Basit_128kbps` seul. Un seul recitant => la liste deroulante
   de recitants est **masquee** en mode Warsh.
4. **Changement de mode** : on garde la sourate, on **revient au verset 1**, la lecture
   **redemarre**, et le recitant par defaut du mode est selectionne.
5. **Police Hafs** : Amiri Quran seule (QCF2001 ecarte, section 2.6).
6. **Mode au demarrage** : Warsh (comportement actuel preserve).
7. Le `title` reste, le decoratif « Nuit enluminee » reste, le zoom proportionnel
   `clamp(1.55rem, 3.4vw, 3.25rem)` reste, l'autoplay inconditionnel au changement de
   sourate reste.

## 4. Couche de donnees : deux corpus

### 4.1 `src/data/quran-hafs.json` (nouveau)

Exactement la forme de `quran-warsh.json` : `surahs: [{ n, name, a: [[juz, page, texte], ...] }]`,
6236 lignes au total.

Ingest depuis api.quran.com, 114 requetes (une par sourate). Le script d'ingest
**valide chaque sourate contre `verses_count`** de `/chapters` avant d'ecrire, et
refuse d'ecrire si un seul compte diverge. Une reponse HTML au lieu de JSON (rate limit)
est une erreur, pas un corpus vide : le script echoue plutot que d'ecrire 31 sourates.

### 4.2 `src/data/corpora.ts` (nouveau)

```ts
import warsh from "./quran-warsh.json";
import hafs from "./quran-hafs.json";

export const CORPORA = { warsh: warsh as QuranData, hafs: hafs as QuranData };
export function corpusOf(riwaya: Riwaya): QuranData { return CORPORA[riwaya]; }
```

Point unique de resolution « mode -> texte ». Aucun autre module n'importe une
corpus directement.

### 4.3 `scripts/lib/manifest.mjs`

`AYAH_RECITERS` gagne un champ `riwaya` ; les identifiants globaux restent uniques
(Warsh = 1, Hafs = 2 a 8). Deux accesseurs remplacent `selectAyahReciter` :

- `rewayaReciters(riwaya)` : la liste des recitants du mode.
- `defaultAyahReciter(riwaya)` : le recitant par defaut du mode.

`KFGQPC.expected.ayahCount = 6214` ne change pas : il decrit le corpus Warsh, et
`manifest.mjs` reste le controle de coherence pour Warsh.

## 5. Repartition des recitants

| Riwaya | Recitants (dossier everyayah) |
| --- | --- |
| `warsh` | `warsh_Abdul_Basit_128kbps` |
| `hafs` | `Husary_128kbps`, `Yasser_Ad-Dussary_128kbps`, `Minshawy_Murattal_128kbps`, `Mohammad_al_Tablaway_128kbps`, `Abdurrahmaan_As-Sudais_192kbps`, `Hani_Rifai_192kbps`, `Abdul_Basit_Murattal_192kbps` |

L'URL reste `${EVERYAYAH_BASE}/${dir}/${pad3(surah)}${pad3(ayah)}.mp3`. Le prefixe
`/data/warsh` de `EVERYAYAH_BASE` est un **prefixe de dossier, pas une convention de
nommage** : les recitants Warsh vivent sous `/data/warsh/<dir>/` et les recitants Hafs
sous `/data/<dir>/`. `ayahUrl()` doit donc choisir la base selon le mode ; le format du
nom de fichier est identique. (Verifier : omettre le prefixe `warsh/` renvoie 404.)

Le recitant par defaut reste **Khalil Alhosary** (Husary) en Hafs, et
`warsh_Abdul_Basit_128kbps` en Warsh.

## 6. Le point critique : la cle de redemarrage

`use-ayah-player.ts` (ligne 200) :

```ts
lastKeyRef.current = { reciterId, surah, ayahCount };
const memeLecture = previous.surah === surah && previous.ayahCount === ayahCount;
```

La cle ne contient **pas** la riwaya. Or `position = memeLecture ? indexRef.current : 0`
puis `relancer = !memeLecture || playingRef.current`.

Sur les **64 sourates ou les deux corpus ont le meme compte**, `memeLecture` serait vrai
malgre le changement de mode : la position serait conservee et la lecture ne
redemarrerait pas. C'est exactement le contraire du comportement demande (point 4 des
decisions).

**Correctif : `riwaya` entre dans la cle** (dans `lastKeyRef.current` et dans les
dependances de l'effet). Alors `memeLecture` est faux au changement de mode, `position`
vaut 0, `relancer` vaut `true` : on revient au verset 1 et la lecture repart. Aucun autre
changement de comportement.

## 7. Typographie

`src/styles/fonts.css` : ajout de `@font-face` pour **Amiri Quran** (woff2, 60 Ko, dans
`src/assets/fonts/`). La police Warsh actuelle reste declaree et inchangee.

`src/styles/app.css` : `.ayah-text` recoit une pile par mode, portee par un attribut
plutot que par une classe CSS (evite de dependre de l'ordre de cascade) :

- mode `warsh` : la pile actuelle (`KFGQPC Warsh`, ...).
- mode `hafs` : `"Amiri Quran", "Traditional Arabic", serif`.

## 8. Timings

Les tables `src/data/timings/120/*` decrivent le moshaf **Warsh** (sourate 2 = 285
lignes). Elles sont desynchronisees sur le texte Hafs (sourate 2 = 286 versets).

Decision : **les timings ne sont charges qu'en mode Warsh**. En mode Hafs on passe
`null` a `AyahList`. La progression retombe alors sur `verse / total`, et le badge
« dures estimees » disparait de lui-meme (le test est
`timings && timings.precision !== "exact"`).

## 9. Etat de session

```ts
type SessionState = { riwaya: Riwaya; surah: number; ayah: number; reciter: number };
```

`setRiwaya` remet `reciter` au defaut du mode et `ayah` a 1, et laisse `surah` intact
(decision 4). Une session existante sans `riwaya` se lit comme `warsh`, donc les
sessions deja enregistrees continuent de s'ouvrir en Warsh.

## 10. Interface

- **Selecteur de mode** dans `PlayerBar`, a cote du select de sourate : `Warsh` /
  `Hafs`.
- **Select de recitant masque** quand le mode n'a qu'un recitant (Warsh). En Hafs il
  liste les 7.
- **Titre** dynamique : « Coran — Warsh » / « Coran — Hafs ».
- `DownloadPanel` recoit deja `quran` en propriete : les telechargements suivent le mode
  sans modification de code.
- `AyahList` et `SurahPicker` recoivent le corpus et la liste de recitants du mode.

## 11. Cache audio

`CACHE_NAME = "coran-warsh-ayah-v1"` est **conserve**. Le Cache Storage est indexe par
URL, et les URL Warsh et Hafs ne peuvent pas entrer en collision
(`/data/warsh/<dir>/...` contre `/data/<dir>/...`). Renommer la constante orphelinerait
les telechargements deja faits par les utilisateurs, sans gain.

## 12. Tests

- `corpora` : les deux corpus ont 114 sourates ; totaux 6214 et 6236 ; la sourate 2
  fait 285 et 286 ; `corpusOf` renvoie le bon objet pour chaque mode.
- `manifest` : `rewayaReciters("warsh")` rend 1 element, `rewayaReciters("hafs")` rend
  7 ; `defaultAyahReciter` rend un identifiant present dans le mode ; aucun identifiant
  n'est partage entre les deux modes.
- `session` : `setRiwaya` remet le recitant par defaut et l'ayah a 1, conserve la
  sourate ; une session sans `riwaya` se lit `warsh`.
- `use-ayah-player` : changer de riwaya **sur une sourate ou les comptes sont egaux**
  (sourate 1, 114 = 7 v. 7) replace a 0 et redemarre la lecture. Ce test verrouille la
  section 6 ; sans lui, la correction peut disparaitre en silence.
- `PlayerBar` : le select de recitant est absent en Warsh, present en Hafs ; le
  selecteur de mode propose les deux lectures.
- `styles` : `.ayah-text` en mode Hafs cite Amiri Quran en tete de pile.

## 13. Risques

- **Taille du corpus** : `quran-hafs.json` ajoute ~1 Mo de JSON au bundle. Le corpus
  Warsh est deja embarque de la meme facon ; on ne change pas de strategie. Si le poids
  devient un probleme, les deux corpus peuvent passer en `import()` dynamique.
- **Derive future d'api.quran.com** : le texte est **copie dans le depot**, pas
  interroge au runtime. L'application ne depend donc pas de la disponibilite de l'API.
- **Un nouveau recitant** doit etre audite sur les 114 sourates avant d'entrer dans la
  liste. `hafs-reciters-audit.json` est la procedure.
- **Recitons avec un dossier `warsh/` errone** : le prefixe de dossier rend cette
  erreur facile a reproduire. Un test de comptage par recitant la rattraperait.

## 14. Alternatives ecartees

- **Corriger la logique de reprise** : ecarte. La section 2.1 montre que l'etat
  « surbrillance N / audio N-1 » est inatteignable ; il n'y a rien a corriger.
- **Un seul corpus, deux jeux de recitants** : ecarte. C'est precisement le montage
  actuel ; il suppose que le texte est commun aux deux, ce qui est faux (6214 contre
  6236).
- **Forcer la traduction Hafs -> segmentation Warsh** : ecarte. Le texte de l'ecran et
  le fichier audio ne parle plus le meme decoupage ; le decalage change de forme au
  lieu de disparaitre.
- **Embarquer QCF2001 « au cas ou »** : ecarte (section 2.6). 618 Ko pour zéro glyphe
  rendu.
- **Renommer le cache audio** : ecarte (section 11).

## 15. Provenance

- Texte Hafs : `https://api.quran.com/api/v4/` (uthmani, `page_number`, `juz_number`).
- Texte Warsh : `kfgqpc_warsh_v30.json` (KFGQPC, via everyayah), deja dans le depot.
- Audio : `https://everyayah.com/data/` (`/warsh/<dir>/` pour Warsh, `/<dir>/` pour Hafs).
- Police : Amiri Quran (SIL OFL 1.1).
- Mesures : `audit-versets.json`, `hafs-reciters-audit.json`.