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

// Plan 2/3 (lecture par verset) — source audio `NNNMMM.mp3` (padding 3+3), deux bases
// de dossier par riwaya (T2) : Warsh vit sous `/data/warsh/`, Hafs sous `/data/`.
// Verifie le 2026-09-28 : seul `warsh_Abdul_Basit_128kbps` repond 200 a HEAD sur
// `<dir>/112001.mp3` (audio/mpeg, Accept-Ranges: bytes, CORS *), 6214 mp3 pour la
// totalite des ayat Warsh. Les deux autres repertoires Warsh annonces a l'origine
// (`warsh_ibrahim_aldosary_128kbps`, `warsh_yassin_al_jazaery_64kbps`) etaient
// defectueux (404), pas mal nommes : ils ont ete retires de la table en T2 — leurs
// recitants existent en dossier Hafs. Les sept dossiers Hafs ont ete verifies plus
// tard (6236 versets, zero divergence sur 114 sourates, `hafs-reciters-audit.json`).
export const EVERYAYAH_BASE_WARSH = "https://everyayah.com/data/warsh";
export const EVERYAYAH_BASE_HAFS = "https://everyayah.com/data";
// Alias historique (tests existants l'importent) : la base Warsh reste la reference
// du corpus d'origine.
export const EVERYAYAH_BASE = EVERYAYAH_BASE_WARSH;

// Plan 3 (T2) — table unique des deux modes : ids globaux 1..8, Warsh = 1,
// Hafs = 2..8, aucun id partage : `selectAyahReciter(id)` reste une recherche
// globale non ambigue. `priority === 0` est le defaut de son mode.
export const AYAH_RECITERS = Object.freeze([
  Object.freeze({
    id: 1,
    dir: "warsh_Abdul_Basit_128kbps",
    bitrate: 128,
    label: "Abdul Basit — Warsh 128kbps",
    labelFr: "Abdul Baasit (Warsh, 128 kbps)",
    priority: 0,
    riwaya: "warsh",
  }),
  Object.freeze({
    id: 2,
    dir: "Husary_128kbps",
    bitrate: 128,
    label: "Khalil Al-Husary — Hafs 128kbps",
    labelFr: "Khalil Al-Husary (Hafs, 128 kbps)",
    priority: 0,
    riwaya: "hafs",
  }),
  Object.freeze({
    id: 3,
    dir: "Yasser_Ad-Dussary_128kbps",
    bitrate: 128,
    label: "Yasser Ad-Dussary — Hafs 128kbps",
    labelFr: "Ibrahim Al-Dosari (Hafs, 128 kbps)",
    priority: 1,
    riwaya: "hafs",
  }),
  Object.freeze({
    id: 4,
    dir: "Minshawy_Murattal_128kbps",
    bitrate: 128,
    label: "Al-Minshawi — Hafs Murattal 128kbps",
    labelFr: "Al-Minshawi (Hafs, Murattal)",
    priority: 2,
    riwaya: "hafs",
  }),
  Object.freeze({
    id: 5,
    dir: "Mohammad_al_Tablaway_128kbps",
    bitrate: 128,
    label: "Muhammad al-Tablaway — Hafs 128kbps",
    labelFr: "Muhammad al-Tablaway (Hafs, 128 kbps)",
    priority: 3,
    riwaya: "hafs",
  }),
  Object.freeze({
    id: 6,
    dir: "Abdurrahmaan_As-Sudais_192kbps",
    bitrate: 192,
    label: "Abdurrahmaan As-Sudais — Hafs 192kbps",
    labelFr: "Abdurrahmaan As-Sudais (Hafs, 192 kbps)",
    priority: 4,
    riwaya: "hafs",
  }),
  Object.freeze({
    id: 7,
    dir: "Hani_Rifai_192kbps",
    bitrate: 192,
    label: "Hani Rifai — Hafs 192kbps",
    labelFr: "Hani Rifai (Hafs, 192 kbps)",
    priority: 5,
    riwaya: "hafs",
  }),
  Object.freeze({
    id: 8,
    dir: "Abdul_Basit_Murattal_192kbps",
    bitrate: 192,
    label: "Abdul Basit — Hafs Murattal 192kbps",
    labelFr: "Abdul Baasit (Hafs, Murattal 192 kbps)",
    priority: 6,
    riwaya: "hafs",
  }),
]);

// Base everyayah de la riwaya : la Warsh ajoute le segment `/warsh`, pas la Hafs.
export function everyayahBase(riwaya) {
  return riwaya === "hafs" ? EVERYAYAH_BASE_HAFS : EVERYAYAH_BASE_WARSH;
}

// Filtre sur la table globale (pas de copie de la table mere : `filter` renvoie
// les memes objets figes).
export function rewayaReciters(riwaya) {
  return AYAH_RECITERS.filter((r) => r.riwaya === riwaya);
}

// Defaut d'un mode : l'entree `priority === 0`. Absent = erreur explicite :
// un defaut muet serait un mode sans voix.
export function defaultAyahReciter(riwaya) {
  const defaut = rewayaReciters(riwaya).find((r) => r.priority === 0);
  if (!defaut) {
    throw new Error(`aucun recitant par-verset par defaut pour la riwaya: ${riwaya}`);
  }
  return defaut;
}

// Resolution globale : les ids 1..8 couvrent les deux modes sans recouvrement.
export function selectAyahReciter(raw) {
  if (raw === undefined || raw === "") return AYAH_RECITERS[0];
  if (!/^\d+$/.test(String(raw))) {
    throw new Error(`identifiant de recitant par-verset non numerique: ${raw}`);
  }
  const id = Number(raw);
  const found = AYAH_RECITERS.find((r) => r.id === id);
  if (!found) throw new Error(`recitant par-verset inconnu dans le manifeste: ${id}`);
  return found;
}
