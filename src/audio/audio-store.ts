// Plan 2, T-B — magasin des octets mp3 par verset (Cache Storage).
//
// Choix : Cache Storage, pas IndexedDB — la unite stockee est une reponse HTTP opaque
// (URL -> octets), exactement le modele d'un cache. Pas de service worker ici :
// `caches.open` est accessible depuis la page (origine securisee ; en dev,
// 127.0.0.1/localhost sont traites comme tels par Chromium).
//
// Le magasin ne manipulationne QUE des octets : le decodage en AudioBuffer appartient a
// use-ayah-player (T-D), seul endroite ou un AudioContext existe. Ainsi ce module reste
// testable sans Web Audio (le faux ctx de T-C couvre l'autre moitie).
import type { AyahReciter, QuranData } from "../types";
import { ayahUrl } from "./ayah-source";

export const CACHE_NAME = "coran-warsh-ayah-v1";

export type DownloadUnit = { kind: "surah"; n: number } | { kind: "juz"; j: number };

export interface DownloadProgress {
  done: number;
  total: number;
}

export interface DownloadReport {
  fetched: number;
  skipped: number;
  bytes: number;
}

export interface AyahRef {
  surah: number;
  ayah: number;
}

function openCache(): Promise<Cache> {
  return caches.open(CACHE_NAME);
}

async function getBytes(url: string, cache: Cache): Promise<ArrayBuffer> {
  const hit = await cache.match(url);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`audio introuvable (${res.status}) : ${url}`);
  }
  const buf = await res.arrayBuffer();
  // Le cache n'est jamais bloquant : un quota depasse ou un put refuse ne doit pas
  // empecher la lecture en cours (le geste utilisateur passe avant la persistance).
  try {
    await cache.put(url, new Response(buf.slice(0)));
  } catch (err) {
    console.warn("cache put ignore (quota ?)", url, err);
  }
  return buf;
}

/**
 * Octets du mp3 d'une URL donnee, avec la regle « cache d'abord » :
 * hit cache -> 0 requete ; miss -> fetch + tentative de mise en cache.
 */
export async function getAyahBytes(url: string): Promise<ArrayBuffer> {
  return getBytes(url, await openCache());
}

/**
 * Versets d'une unite telechargeable. `surah` = ses lignes dans l'ordre ; `juz` =
 * tous les (s, a) avec `row[0] === j` a travers le corpus, tries par (s, a).
 * Le juz se lit directement dans `quran-warsh.json` : aucun second ingest necessaire.
 */
export function listAyats(quran: QuranData, unit: DownloadUnit): AyahRef[] {
  if (unit.kind === "surah") {
    const s = quran.surahs[unit.n - 1];
    if (!s) throw new RangeError(`sourate inexistante: ${unit.n}`);
    return s.a.map((_row, i) => ({ surah: unit.n, ayah: i + 1 }));
  }
  if (unit.j < 1 || unit.j > quran.meta.juzCount) {
    throw new RangeError(`juz hors [1, ${quran.meta.juzCount}]: ${unit.j}`);
  }
  const refs: AyahRef[] = [];
  quran.surahs.forEach((s) => {
    s.a.forEach((row, i) => {
      if (row[0] === unit.j) refs.push({ surah: s.n, ayah: i + 1 });
    });
  });
  return refs;
}

export interface DownloadOptions {
  concurrency?: number;
  onProgress?: (p: DownloadProgress) => void;
  isAborted?: () => boolean;
}

/**
 * Pre-remplit le cache pour une sourate ou un juz.
 * - Idempotent : les URL deja en cache sont comptees `skipped`, jamais re-fetch.
 * - Concurrence bornee (defaut 4) : la pool ne depasse jamais `concurrency` en vol.
 * - Annulable : `isAborted()` est testee avant chaque nouveau job.
 * Aucune requete automatique du corpus entier n'existe ailleurs : le volume vient
 * uniquement des boutons explicites de DownloadPanel (T-D).
 */
export async function downloadUnit(
  unit: DownloadUnit,
  reciter: AyahReciter,
  quran: QuranData,
  opts: DownloadOptions = {},
): Promise<DownloadReport> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const refs = listAyats(quran, unit);
  const total = refs.length;
  const cache = await openCache();

  let next = 0;
  let done = 0;
  let fetched = 0;
  let skipped = 0;
  let bytes = 0;

  const job = async (): Promise<void> => {
    for (;;) {
      if (opts.isAborted?.()) return;
      const i = next;
      next += 1;
      if (i >= total) return;
      const ref = refs[i];
      const count = quran.surahs[ref.surah - 1].a.length;
      const url = ayahUrl(reciter, ref.surah, ref.ayah, count);
      if (await cache.match(url)) {
        skipped += 1;
      } else {
        // `bytes += (await ...)` est une course : `+=` lit la cible AVANT l'await,
        // les N jobs concurrents ajoutent donc tous a la valeur de depart (mesure :
        // 4 fetchs de 4 octets = total 4 au lieu de 16). On attend d'abord, on
        // additionne ensuite, sequentiellement dans ce micro-tache.
        const buf = await getBytes(url, cache);
        bytes += buf.byteLength;
        fetched += 1;
      }
      done += 1;
      opts.onProgress?.({ done, total });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => job()),
  );
  return { fetched, skipped, bytes };
}
