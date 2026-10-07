# Vérification réseau mp3quran — observations réelles

Date : 2026-09-27. Méthode : sondes HTTP en lecture seule (`curl.exe` + Node 25 `fetch`).
Aucune donnée n'a été écrite dans le dépôt par ces sondes.

Ce document consigne ce que l'API et les hôtes audio répondent **réellement**. Plusieurs
hypothèses du plan d'exécution se sont révélées fausses ; la section « Divergences » les
énumère précisément. **Ne pas implémenter le plan avant de les avoir tranchées.**

---

## 1. Hôtes audio — les quatre candidats

| URL | Statut | `content-type` |
|---|---|---|
| `https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi/002.mp3` | **200** | `audio/mpeg` |
| `https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi/112.mp3` | **200** | `audio/mpeg` |
| `https://server8.mp3quran.net/husr/002.mp3` | **502** | `text/plain` |
| `https://server8.mp3quran.net/husr/112.mp3` | **502** | `text/plain` |

La conclusion attendue par le plan est confirmée : seule la branche `Rewayat-Warsh-A-n-Nafi/`
est admissible. L'hôte Hafs `server8` est en outre **mort (502 Bad Gateway)**, pas seulement
« différent ».

## 2. L'endpoint de l'API documenté dans le plan est mort

`https://mp3quran.net/api/v3/ayah_timings?surah=1&read=118` répond **301** vers
`https://www.mp3quran.net/...`, puis **404** après redirection vers la locale `/ar/`.

| Candidat | Résultat |
|---|---|
| `www.mp3quran.net/api/v3/ayat_timing?surah=1&read=118` | **200**, `application/json`, 1360 o |
| `www.mp3quran.net/api/v3/ayah_timing?...` | 404 |
| `www.mp3quran.net/api/v3/ayat_timings?...` | 404 |
| `www.mp3quran.net/api/v3/reciters?language=eng` | 200, 159 867 o |
| `www.mp3quran.net/api/v3/riwayat` | 200, 2365 o |

Deux corrections : le nom est **`ayat_timing`** (singulier, sans « h »), et l'hôte est
**`www.`**. Les requêtes doivent suivre la redirection.

## 3. `read=118` n'est PAS Warsh — c'est Hafs

`reciters?language=eng` retourne 242 récitants. Le récitant `118`
(*Mahmoud Khalil Al-Hussary*) expose **cinq moshaf distincts** ; son moshaf par défaut
`id=118` est **« Rewayat Hafs A'n Assem »**, serveur `https://server13.mp3quran.net/husr/`
— l'hôte Hafs, distinct de la branche Warsh.

Warsh est un **autre moshaf du même récitant** :

- `id=120` — « Rewayat Warsh A'n Nafi' - Murattal », `rewaya_id=2`
- serveur `https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi/`
- `surah_total=114`, `moshaf_type=21`

Le paramètre de lecture des timings Warsh est donc **`read=120`**, et non `read=118`.

### Conséquence mesurée

| | `read=118` (Hafs) | `read=120` (Warsh) | KFGQPC (canonique) |
|---|---|---|---|
| Sourates servies | 114/114 | 114/114 | 114 |
| Total d'entrées | 6349 | **6214** | **6214** |
| Ayat réels (hors basmala) | 6235 | **6214** | **6214** |
| Sourates ≠ KFGQPC | **51 / 114** | **0 / 114** | — |
| Basmala synthétique (`ayah:0`) | présente dans les 114 | **aucune** | — |

Avec `read=118`, **51 sourates sur 114** ont un nombre d'ayat différent de KFGQPC
(écart de −3 à +5, +21 au total). Cela recoupe exactement les ~50 divergences Hafs/Warsh
mesurées précédemment sur les sources : l'API servait bien des timings Hafs.

Avec `read=120`, le total est **exactement 6214** et **aucune sourate ne diverge**.
Il n'y a **pas** de basmala synthétique : `ayah` vaut `1..N` et correspond directement au
`aya_no` de KFGQPC, sans décalage.

## 4. Schéma JSON réel

Tableau **plat** d'ayat, et non `[{ surah, ayahs: [...] }]` :

```json
[
  { "ayah": 1, "polygon": "206.48,46.08 172.36,46.08 172.36,72.23 206.48,72.23",
    "start_time": 6054, "end_time": 15993,
    "x": "178.34", "y": "63.11",
    "page": "https://www.mp3quran.net/api/quran_pages_svg/002.svg" }
]
```

| Champ supposé | Réalité | Type |
|---|---|---|
| `[{surah, ayahs:[…]}]` | tableau plat d'ayat | — |
| `start` / `end` | **`start_time` / `end_time`** | entier, **millisecondes** |
| `segments` | **`polygon`** | chaîne de points SVG `"x,y x,y …"` |
| — | **`x`, `y`** | chaînes (centrage) |
| — | **`page`** | **URL de SVG**, pas un numéro |
| `payload[0].audio` | **champ inexistant** | — |

Il n'y a **aucun champ `audio`** dans la réponse. L'URL audio doit être reconstruite à partir
de `reciters[].moshaf[server]` + `{NNN}.mp3` — ce qui confirme que le repli `AUDIO_BASE` du
plan est non seulement utile mais **obligatoire**.

Contrôle d'intégrité sur les 114 sourates (`read=120`) : `ayah` strictement croissant,
`end_time > start_time` partout, **0 anomalie**.

## 5. Données d'alignement : 26 lacunes en fin de sourate

`polygon` et `page` manquent pour **26 ayat sur 6214** (6188 présents). Les lacunes sont
toujours **la queue** des 18 sourates suivantes :

| Sourate | n | ayat sans `polygon`/`page` |
|---|---|---|
| 5 | 122 | 121, 122 |
| 6 | 167 | 166, 167 |
| 8 | 76 | 76 |
| 9 | 130 | 130 |
| 13 | 44 | 44 |
| 14 | 54 | 53, 54 |
| 19 | 99 | 99 |
| 23 | 119 | 119 |
| 27 | 95 | 94, 95 |
| 35 | 46 | 46 |
| 47 | 39 | 39 |
| 56 | 99 | 97, 98, 99 |
| 67 | 31 | 31 |
| 71 | 30 | 29, 30 |
| 89 | 32 | 31, 32 |
| 96 | 20 | 20 |
| 99 | 9 | 9 |
| 106 | 5 | 5 |

Les **timings audio restent corrects** pour ces 26 ayat ; seule la géométrie d'alignement
manque. L'UI doit dégrader proprement (pas d'erreur, pas de contour).

## 6. Géométrie des pages SVG

- URL : `https://www.mp3quran.net/api/quran_pages_svg/604.svg` → 200, `image/svg+xml`, 303 806 o
- `viewBox="0 0 345 550"`, **sans** attributs `width`/`height`
- Emprise des `polygon` observée (sourate 112) : `x ∈ [0, 343]`, `y ∈ [78, 154]`
  → les coordonnées sont **directement dans le repère du `viewBox`**, aucune mise à l'échelle
  n'est nécessaire si le SVG est rendu avec son `viewBox`.
- Le SVG ne contient que **2 éléments portant un `id`** : il n'existe **aucun élément par
  ayah** auquel se lier. L'alignement doit donc se faire en **superposant un `<polygon>`**
  correspondant à l'ayat actif au-dessus du SVG rendu.

## 7. Tailles audio (moshaf Warsh 120)

| Sourate | `Content-Length` |
|---|---|
| 001 | 473 723 o |
| 002 | 99 486 582 o (**~95 Mo**) |
| 112 | 243 008 o |
| 114 | 438 192 o |

Sourate 2 seule : ~95 Mo. Le chargement direct en mémoire est excluant ; il faut du
streaming par `Range` ou un choix de récitant/sourate plus léger.

---

## Divergences avec le plan d'exécution

Ces points sont **invalidés par l'observation** et doivent être corrigés dans le plan avant
toute implémentation.

1. **Récitant des timings : `read=118` → `read=120`.** `read=118` sert Hafs et fausse le
   survol sur 51 sourates. C'est le défaut silencieux le plus grave du plan.
2. **Endpoint : `ayah_timings` → `ayat_timing`, hôte `www.`, suivre la redirection 301.**
3. **Schéma :** tableau plat, pas un objet par sourate. `{surah, ayahs}` disparaît.
4. **Champs :** `start`/`end` → `start_time`/`end_time` (ms). `segments` → `polygon` (+`x`,`y`).
5. **`payload[0].audio` n'existe pas.** `AUDIO_BASE` devient le chemin unique et l'ingest doit
   Derivatives `reciters` pour le serveur du moshaf.
6. **Pas de basmala synthétique** avec `read=120` : l'offset `ayah-1` et la ligne `basmala`
   prévus par le plan sont invalides.
7. **`page` est une URL SVG**, pas un numéro de page.
8. **18 sourates × 26 ayat** n'ont pas de géométrie : dégradation gracieuse obligatoire.
9. **Tâche 5 (parser/ingest), tâche 12 (lecteur audio) et `App.tsx`** (URL audio, type de
   réponse) sont à réécrire ; les tests associés aussi.
10. **L'alignement** se fait par superposition de `<polygon>` sur le SVG, pas par liaison à
    des éléments `id` (qui n'existent pas).
11. **`App.tsx` codait en dur `https://server8.mp3quran.net/husr/{n}.mp3`**, hôte vérifié
    **502** : la correction déjà apportée au plan était nécessaire et doit être conservée.

## Points restant à trancher

- Stratégie audio pour la sourate 2 (~95 Mo) : streaming `Range`, ou limitation aux sourates
  légères, ou choix d'un autre moshaf Warsh plus compact.
- Le plan doit-il être amendé (nouvelle version) avant d'engager la tâche 1, ou la tâche 1
  peut-elle démarrer car elle ne dépend pas du schéma distant ?
