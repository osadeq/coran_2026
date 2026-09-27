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
