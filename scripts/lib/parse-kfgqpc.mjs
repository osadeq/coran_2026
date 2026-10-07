import { KFGQPC } from "./manifest.mjs";
import { findUnknownExtendedCodepoints, stripAyahEndMarker } from "./text.mjs";

export class IngestError extends Error {
  constructor(message) {
    super(message);
    this.name = "IngestError";
  }
}

const SCHEMA = [
  "id",
  "jozz",
  "page",
  "sura_no",
  "sura_name_en",
  "sura_name_ar",
  "line_start",
  "line_end",
  "aya_no",
  "aya_text_unicode",
];

const NUMERIC = ["id", "jozz", "page", "sura_no", "line_start", "line_end", "aya_no"];

export function parseKfgqpc(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new IngestError("kfgqpc: tableau vide ou invalide");
  }
  if (rows.length !== KFGQPC.expected.ayahCount) {
    throw new IngestError(
      `kfgqpc: ${rows.length} ayat recus, ${KFGQPC.expected.ayahCount} attendus`,
    );
  }

  const surahs = new Map();

  for (const [i, r] of rows.entries()) {
    const line = i + 1;
    const keys = Object.keys(r);
    for (const k of SCHEMA) {
      if (!keys.includes(k)) throw new IngestError(`kfgqpc: champ manquant ${k} (ligne ${line})`);
    }
    for (const k of keys) {
      if (!SCHEMA.includes(k)) {
        throw new IngestError(`kfgqpc: champ inattendu ${k} (ligne ${line})`);
      }
    }
    if (r.id !== line) throw new IngestError(`kfgqpc: id discontinu ligne ${line} (${r.id})`);
    for (const k of NUMERIC) {
      if (!Number.isInteger(r[k])) {
        throw new IngestError(`kfgqpc: ${k} n'est pas un entier (ligne ${line})`);
      }
    }
    if (r.sura_no < 1 || r.sura_no > KFGQPC.expected.surahCount) {
      throw new IngestError(`kfgqpc: sura_no hors bornes ${r.sura_no} (ligne ${line})`);
    }
    if (r.page < 1 || r.page > KFGQPC.expected.pageCount) {
      throw new IngestError(
        `kfgqpc: page hors bornes ${r.page} — ${r.sura_no}:${r.aya_no}`,
      );
    }
    if (r.jozz < 1 || r.jozz > KFGQPC.expected.juzCount) {
      throw new IngestError(
        `kfgqpc: jozz hors bornes ${r.jozz} — ${r.sura_no}:${r.aya_no}`,
      );
    }
    if (r.aya_no < 1) {
      throw new IngestError(`kfgqpc: aya_no invalide ${r.aya_no} (ligne ${line})`);
    }
    if (typeof r.aya_text_unicode !== "string" || r.aya_text_unicode.length === 0) {
      throw new IngestError(`kfgqpc: texte vide (ligne ${line})`);
    }
    const unknown = findUnknownExtendedCodepoints(r.aya_text_unicode);
    if (unknown.length > 0) {
      throw new IngestError(
        `kfgqpc: codepoints etendus inconnus ${unknown.join(" ")} — ${r.sura_no}:${r.aya_no}`,
      );
    }

    let surah = surahs.get(r.sura_no);
    if (!surah) {
      surah = { n: r.sura_no, en: r.sura_name_en, ar: r.sura_name_ar, a: [] };
      surahs.set(r.sura_no, surah);
    }
    const expectedAyah = surah.a.length + 1;
    if (r.aya_no !== expectedAyah) {
      throw new IngestError(
        `kfgqpc: ayah non contigu dans la sourate ${r.sura_no} : attendu ${expectedAyah}, recu ${r.aya_no}`,
      );
    }
    surah.a.push([r.jozz, r.page, stripAyahEndMarker(r.aya_text_unicode)]);
  }

  const list = [...surahs.values()].sort((x, y) => x.n - y.n);
  if (list.length !== KFGQPC.expected.surahCount) {
    throw new IngestError(`kfgqpc: ${list.length} sourates, ${KFGQPC.expected.surahCount} attendues`);
  }
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].n !== i + 1) {
      throw new IngestError(`kfgqpc: sourate ${i + 1} absente`);
    }
  }

  return {
    meta: {
      riwaya: "warsh",
      source: KFGQPC.id,
      ayahCount: rows.length,
      surahCount: list.length,
      pageCount: KFGQPC.expected.pageCount,
      juzCount: KFGQPC.expected.juzCount,
    },
    surahs: list,
  };
}
