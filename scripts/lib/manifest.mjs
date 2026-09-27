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
