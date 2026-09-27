# Design — Lecteur de Coran (riwaya Warsh 'an Nafi)

- **Date** : 2026-09-27
- **Statut** : approuvé
- **Récitant par défaut** : محمود خليل الحصري (Al-Husary, id mp3quran **118**)
- **Riwaya** : ورش عن نافع (`rewaya_id: 2`)
- **Stack** : Vite + React + TypeScript, site 100 % statique

> **Correction du 2026-09-27, 2ᵉ passe.** Une première version de ce document attribuait
> l'id **120** à Al-Husary et en déduisait une couverture partielle à 95–103 %. C'était faux.
> Al-Husary est l'id **118**. L'id 120 est un identifiant **orphelin** : il n'apparaît dans aucune
> liste de récitants (ar, eng, rus, ind, spa, ger, fre, tur, chi, tha, mal, per, nep) mais il
> renvoie bien des timings Warsh. Les mesures initiales portaient donc sur un jeu de données
> inconnu. Les chiffres ci-dessous sont ceux de `read=118`, revérifiés.

---

## 1. Objectif

Application web affichant le Saint Coran en arabe (riwaya Warsh 'an Nafi) avec surbrillance
synchronisée sur la récitation. L'utilisateur choisit la sourate, l'ayah de départ et le
récitant, puis lance la lecture.

Fonctionnalités retenues :

- Sélection de la sourate, de l'ayah de départ et du récitant
- Surbrillance de l'ayah en cours, synchronisée sur l'audio
- Recherche full-text sur les 6236 ayat
- Traduction française (Hamidullah) affichable sous chaque ayah
- Mode « page du Coran » avec surbrillance sur la page du mushaf
- Signets et reprise de lecture
- Interface arabe (RTL) avec bascule vers le français

Non retenues : répétition d'un ayah en boucle, vitesse de lecture, saut ±10 s.

---

## 2. Constats établis par l'investigation

Ils fondent la quasi-totalité des décisions d'architecture. Ils sont reproduits parce
qu'ils ne sont documentés nulle part.

### 2.1 Quran.com v4 est inutilisable pour Warsh

L'API publique v4 ne propose que 12 récitants, tous Hafs. Aucun Warsh. Écarté.

`https://api.alquran.cloud/v1/edition?format=text` est injoignable (transport error).

### 2.2 Récitants Warsh retenus

Source : `https://mp3quran.net/api/v3/reciters?language=ar` (241 récitants), filtrés sur
`rewaya_id === 2`. Le détail d'un récitant se trouve dans le tableau `moshaf[]` de la réponse
de liste ; l'endpoint `reciters/{id}` renvoie 404.

| Récitant | id | Sourates | Audio | Serveur | Timings |
|---|---:|---:|---:|---|---|
| **محمود خليل الحصري** (défaut) | **118** | 114 / 114 | **114 / 114 en 200** | `server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi/` | 12/15 exact sur échantillon |
| محمد سايد | 134 | 114 / 114 | 001 et 114 en 200 | `server16.mp3quran.net/m_sayed/Rewayat-Warsh-A-n-Nafi/` | complet sur 36 et 67 |
| عمر القزابري | 80 | 114 / 114 | — | — | partiel (82/83 sur 36) |
| العيون الكوشي | 16 | 114 / 114 | — | — | partiel (82/83 sur 36) |
| القارئ ياسين | 14 | 114 / 114 | — | — | partiel (82/83 sur 36) |
| **يونس أسويلص** | 264 | **65 / 114** | — | `server16.mp3quran.net/souilass/Rewayat-Warsh-A-n-Nafi/` | **aucun** |
| عبد الباسط عبد الصمد | 52 | 114 / 114 | — | — | aucun |
| إبراهيم الدوسري | 178 | 114 / 114 | — | — | aucun |
| رشيد بلعالية | 27 | 114 / 114 | — | — | aucun |
| عبد المجيب بنكيران | 10920 | 114 / 114 | — | — | aucun |

`read=120` est un **identifiant orphelin** : absent de toutes les listes de récitants, mais il
renvoie des timings Warsh plausibles. Interdit d'usage — un jeu de données non attribuable ne
peut pas piloter une fonctionnalité de synchronisation. Cette confusion a coûté une passe
entière de mesures ; le script d'ingest doit donc **échouer bruyamment** sur tout `read` absent
de la liste des récitants.

### 2.3 Younes Souilass ne peut pas porter la fonctionnalité centrale

Le réciteur initialement demandé n'a **aucun** timing et ne couvre que 65 sourates sur 114.
Manquantes : 7, 8, 9, 44, 49, 58–66, 68–70, 72, 74, 75, 83–85, 87, 88, 92, 94, 96, 98–111, 113, 114.

Décision : il reste sélectionnable, mais le défaut passe à Al-Husary, et un moteur de repli couvre
l'absence de timings.

### 2.4 Les timings mp3quran ne sont pas fiables tels quels

`https://mp3quran.net/api/v3/ayat_timing?surah={n}&read={id}` renvoie, par entrée :
`ayah`, `polygon`, `start_time`, `end_time`, `x`, `y`, `page`.

Points positifs vérifiés :

- **contiguïté parfaite** : `end_time[n] === start_time[n+1]`, 0 rupture sur 82 entrées
- CORS `Access-Control-Allow-Origin: *` sur `mp3quran.net` et sur `www.mp3quran.net`
- `page` renvoie le SVG de la page du mushaf de Médine, avec la bonne numérotation
  (`601` = Al-Fatiha, `604` = Al-Ikhlas / An-Nas) :
  `https://www.mp3quran.net/api/quran_pages_svg/604.svg` — 303 Ko, CORS `*`
- `polygon` donne les coordonnées réelles de l'ayah sur la page → surbrillance exacte possible

**Convention de numérotation :** Al-Husary insère une entrée synthétique `ayah: 0` représentant
la basmala, avec `start_time: 0`, `polygon: null`, `page: null`. Muhammad Sayed, lui, n'insère
rien (`surah 36` : 83 entrées, ayah max 83, offset 0). Les deux conventions coexistent : c'est la
présence d'une entrée `ayah == 0` qui tranche.

Mesures réelles sur `read=118` (Al-Husary), 15 sourates :

| Sourate | Ayat | Entrées | ayah max | Verdict |
|---:|---:|---:|---:|---|
| 1 Al-Fatiha | 7 | 7 | 6 | partial — basmala synth, ayah 7 manquant |
| 2 Al-Baqarah | 286 | 287 | 286 | exact |
| 7 Al-A'raf | 202 | 207 | 206 | **anomalie** |
| 9 At-Tawba | 129 | 130 | 129 | exact |
| 18 Al-Kahf | 110 | 111 | 110 | exact |
| 27 An-Naml | 28 | 94 | 93 | **anomalie** |
| 36 Ya-Sin | 83 | 84 | 83 | exact |
| 55 Ar-Rahman | 78 | 79 | 78 | exact |
| 67 Al-Mulk | 30 | 31 | 30 | exact |
| 78 An-Naba | 40 | 41 | 40 | exact |
| 96 Al-Alaq | 5 | 20 | 19 | **anomalie** |
| 110 Ad-Duha | 4 | 4 | 3 | partial — ayah 4 manquant |
| 112 Al-Ikhlas | 4 | 5 | 4 | exact |
| 113 Al-Falaq | 5 | 6 | 5 | exact |
| 114 An-Nas | 6 | 7 | 6 | exact |

Bilan : 12 exact, 2 partial, 3 anomalies. Les sourates 7, 27 et 96 renvoient des timings
corrompus (96 — Al-Alaq — annonce 19 ayat ; 27 — An-Naml — en annonce 93).

Conséquence : **la réponse n'est jamais consommée directement par le client.** Elle est ingérée,
classée et validée au build. Une sourate non validée bascule en `estimated` plutôt que de
désynchroniser silencieusement.

### 2.5 Aucun texte Warsh n'est disponible via API

mp3quran n'expose aucun endpoint de texte (`/quran/{n}`, `/quran_text/{n}`, `/text/{n}`,
`/ayat/{n}`, `/tafsir/{n}` → 404 tous). `raw.githubusercontent.com` est injoignable depuis
l'environnement de développement.

Sources retenues pour le texte, dans cet ordre :

1. `ar.wikisource.org` via l'API MediaWiki (confirmé joignable, HTTP 200)
2. dataset JSON de repli, via jsDelivr

Le texte est **figé dans le dépôt au build**, jamais lu à l'exécution.

### 2.6 Limite de granularité

Aucun jeu de données mot-à-mot n'existe pour la riwaya Warsh. La granularité maximale est
**l'ayah**. Le site n'inventera pas de faux timings mot-à-mot.

---

## 3. Couche de données

Un script `scripts/ingest.mjs` produit `src/data/`. Seul l'audio est lu sur le réseau à
l'exécution.

| Fichier | Contenu | Origine |
|---|---|---|
| `quran-warsh.json` | 114 sourates, 6236 ayat, texte Warsh | ar.wikisource.org, puis dataset JSON |
| `translations-fr.json` | 6236 ayat, Hamidullah | API publique de traduction |
| `meta.json` | nom ar/fr, nombre d'ayat, type de révélation, juz, hizb | dérivé |
| `timings/{reciter}/{surah}.json` | table de sync validée | `ayat_timing` mp3quran |
| `pages.json` | map ayah → URL de page SVG | champ `page` des timings |

### 3.1 Schéma d'une table de timings validée

Extrait réel, Al-Husary sourate 2 (`offset: 1`, l'entrée `ayah: 0` est la basmala) :

```jsonc
{
  "surah": 2,
  "reciter": 118,
  "reciterName": "محمود خليل الحصري",
  "riwaya": 2,
  "offset": 1,             // 1 = entrée ayah 0 = basmala synthétique présente
  "coveredMax": 286,       // plus grand numéro d'ayah réellement couvert
  "precision": "exact",    // "exact" | "partial" | "estimated"
  "audio": "https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi/002.mp3",
  "audioBytes": null,      // renseigné par le build
  "ayat": [
    { "n": 1, "start": 11705, "end": 18048,
      "page": "https://www.mp3quran.net/api/quran_pages_svg/002.svg",
      "polygon": "181.08,18.31 57.54,18.31 57.54,48.94 181.08,48.94" }
  ]
}
```

Les timestamps sont conservés **en millisecondes, entiers**, comme fournis par l'API. Pas de
conversion en flottants dans le fichier : la conversion en secondes se fait à la lecture.

### 3.2 Règles de classification

Soit `A` le nombre d'ayat canonique de la sourate, `entries` le nombre d'entrées reçues,
`coveredMax` le plus grand numéro d'ayah après retrait de l'éventuelle entrée `ayah: 0`.

| Condition | `precision` | Traitement |
|---|---|---|
| `coveredMax === A` | `exact` | sync aux ms |
| `coveredMax < A` | `partial` | sync réelle sur `[1, coveredMax]`, repli estimé sur la queue |
| `coveredMax > A` | `estimated` | repli intégral, sourate signalée dans le rapport |
| aucune entrée | `estimated` | repli intégral |
| `read` absent de la liste des récitants | **échec du build** | identifiant non attribuable |

Le seuil de bascule en `estimated` est `coveredMax > A` : c'est le seul cas qui signale des
données corrompues plutôt qu'incomplètes. Aucune donnée ne peut produire un décalage silencieux
entre l'audio et le texte affiché.

### 3.3 Cas particuliers de la basmala

- une entrée `ayah: 0` avec `polygon: null` et `page: null` est une basmala synthétique : elle
  n'est rattachée à aucun ayah du texte et sert uniquement d'ancrage de début
- la basmala est aussi l'ayah 30 d'An-Naml (27) et l'ayah 1 de plusieurs sourates selon le
  mushaf : le décompte de référence est unique, explicite dans `meta.json`, et sert de vérité
  unique pour l'ingest comme pour le client
- sourates 1 et 9 : pas de basmala dans le décompte du texte, alors que le timing peut en
  contenir une entrée synthétique ; l'ingest ne les aligne jamais par simple arithmétique

### 3.4 Map des pages

Le champ `page` des timings est autoritaire pour le rattachement ayah → page du mushaf Warsh.
Comme la couverture diffère d'un réciteur à l'autre, `pages.json` est construit par **fusion** de
la couverture de tous les réciteurs timings, en retenant pour chaque ayah la première valeur
non nulle. L'ordre de priorité est : Al-Husary, puis Muhammad Sayed, puis les autres. Les ayahs
non couverts par aucun réciteur sont comblés par interpolation entre pages voisines et signalés
dans le rapport.

### 3.5 Contrat de l'ingest

- **idempotent** : deux exécutions produisent des fichiers identiques
- **échec bruyant** : source de texte introuvable, compte d'ayat incohérent, ou `read`
  non attribuable → le build échoue avec le détail de la sourate
- **rapport** : `ingest-report.json` liste, par sourate et par réciteur, la précision obtenue,
  l'offset appliqué et les ayahs tombés en repli estimé
- **aucun secret, aucune clé d'API** requise
- **cache** : les réponses HTTP brutes sont conservées dans `.cache/` et réutilisées, pour ne pas
  hammers mp3quran et pour rendre les builds reproductibles hors ligne

---

## 4. Moteur de synchronisation

```
requestAnimationFrame
  └─ t = audio.currentTime (secondes)
     └─ b = t * 1000
        └─ recherche binaire dans timings[].start/end  → index i
           └─ si hors plage couverte → repli estimé
              └─ setCurrentAyah(timings[i].n)
```

- `exact` : timestamps réels, précision de la milliseconde
- `partial` : timestamps réels sur la plage couverte, estimation pondérée par nombre de mots sur
  la queue
- `estimated` : durée totale répartie au prorata du nombre de mots de chaque ayah

Toute position obtenue par estimation est signalée à l'UI, qui affiche un badge
« تزامن تقريبي / sync approximative ».

### 4.1 Comportement du lecteur

- `<audio>` unique, `src` = MP3 de la sourate, streaming
- la lecture démarre au `start` de l'ayah choisi
- le défilement suit l'ayah courant, avec interpolation douce, et s'arrête si l'utilisateur
  défile manuellement
- à la fin d'une sourate, lecture suivante optionnelle
- aucune vitesse, aucun saut ±10 s (hors périmètre)

### 4.2 Récitants

- défaut : محمود خليل الحصري (118), 114/114 en audio
- Younes Souilass (264) sélectionnable : `estimated` partout, et proposition de changement de
  réciteur sur ses 49 sourates absentes
- la liste propose en priorité les récitants Warsh ayant des timings exploitables, puis les
  autres, avec pour chacun un badge de précision par sourate

---

## 5. Interface

Trois vues, RTL natif, bascule **ع / FR** sur les libellés et sur `dir`.

### 5.1 Lecture

Liste des ayat. L'ayah courant est surligné, avec défilement automatique. En-tête figé :
sourate, ayah de départ, sélecteur de récitant, source audio, badge de précision.

### 5.2 Page du Coran

Rendu du SVG de la page du mushaf de Médine, avec le polygone réel de l'ayah courant posé en
surbrillance. Navigation page précédente / suivante. Bascule entre vue « liste d'ayat » et vue
« page ».

### 5.3 Recherche

Index inversé sur forme arabe normalisée (aléfs unifiés, suppression des diacritiques, du tatweel
et des chiffres-lehs), construit au build et chargé dans un Web Worker au premier usage. Recherche
sur le texte arabe et sur la traduction française. Chaque résultat affiche le contexte et navigue
vers l'ayah correspondant.

### 5.4 Typographie et sens d'écriture

- texte coranique en police Uthmani avec repli (`Amiri Quran`, `KFGQPC Hafs`)
- `dir="rtl"` sur le conteneur du texte coranique
- `dir="ltr"` forcé sur les compteurs d'ayah et les champs numériques
- les nombres d'ayah sont rendus via le glyphe ۝ (U+06DD) quand la police le fournit

### 5.5 Persistance

`localStorage`, versionné par clé : signets, position de reprise, sourate et ayah courants,
récitant, langue. Aucune donnée personnelle, aucun compte.

---

## 6. Tests

| Niveau | Couverture |
|---|---|
| Unitaire | offset et basmala synthétique, classification `coveredMax` vs `A`, calcul d'estimation, recherche binaire, normalisation arabe, index de recherche, refus d'un `read` orphelin |
| Intégration | lecture d'une sourate, bascule de langue, recherche, signets, repli estimé |
| E2E (Playwright) | parcours complet avec vrai audio : vérifier que la surbrillance suit la récitation sur une sourate courte (112) et une longue (36) |

Le test E2E est la seule preuve que la fonctionnalité centrale fonctionne. Il ne peut pas être
remplacé par un test unitaire sur la recherche binaire.

---

## 7. Découpage

1. **Socle** — ingestion des données, table de sync validée, moteur de synchronisation, lecture
2. **Page du Coran** — rendu SVG, polygones, navigation
3. **Recherche et signets** — index, Web Worker, persistance
4. **i18n et finitions** — bascule AR/FR, badge de précision, responsive

Chaque phase produit un site fonctionnel.

---

## 8. Risques assumés

| Risque | Traitement |
|---|---|
| mp3quran ne versionne pas ses données, ni ne garantit la stabilité du schéma | timings figés au build ; l'exécution ne dépend plus du service |
| Identifiants non attribuables (`read=120`) | l'ingest échoue sur tout `read` absent de la liste des récitants |
| Sourates à timings corrompus (7, 27, 96 chez Al-Husary) | bascule en `estimated`, signalée dans le rapport et dans l'UI |
| Queues manquantes (1 et 110) | repli estimé sur la queue, badge affiché |
| Deux conventions de numérotation coexistent (basmala synthétique ou non) | détection par présence de `ayah == 0`, jamais par arithmétique |
| Texte Warsh issu d'une source tierce sans garantie de stabilité | figé au build, provenance et date de collecte dans le dépôt |
| Younes Souilass incomplet | sélectionnable, `estimated`, proposition de changement |
| Granularité limitée à l'ayah | assumée et documentée, aucun faux timing mot-à-mot |
| SVG de page volumineux (303 Ko) | chargés uniquement pour la page affichée |
| Le texte du mushaf (Warsh) peut différer du décompte de l'API | `meta.json` est la référence unique, l'ingest échoue en cas d'écart |

---

## 9. Alternatives écartées

- **Quran.com v4** — pas de Warsh
- **Word-level sync** — aucun jeu de données Warsh mot-à-mot n'existe
- **Next.js / SSR** — inutile, l'application est entièrement statique
- **Lecture des timings mp3quran à l'exécution** — fragile, couple le site à un service tiers
  non versionné et non attribué
- **Tarteel / EveryAyah** — non évaluées faute de timings Warsh vérifiés ; retenues seulement si
  l'ingest révèle que mp3quran ne couvre pas assez de sourates en précision exacte
