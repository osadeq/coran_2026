#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as QM from "quran-meta/warsh";
import { KFGQPC, RECITERS, TIMINGS_ENDPOINT, AUDIO_BASE, selectReciter } from "./lib/manifest.mjs";
import { md5Hex, sha256File } from "./lib/verify.mjs";
import { IngestError, parseKfgqpc } from "./lib/parse-kfgqpc.mjs";
import { compareWithQuranMeta } from "./lib/corroborate.mjs";
import { classifyTimings, normalizeTimings } from "./lib/timings.mjs";
import { estimateTail } from "./lib/estimate.mjs";
import { writeJsonAtomic } from "./lib/io.mjs";
import surahCounts from "./fixtures/surah-counts.json" with { type: "json" };
import divergence from "./fixtures/juz-divergence.json" with { type: "json" };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache");
const DATA = join(ROOT, "src", "data");
const warsh = QM.default ?? QM;

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const OFFLINE = process.argv.includes("--offline");

function log(step, message) {
  process.stdout.write(`[ingest:${step}] ${message}\n`);
}

async function resolveZip() {
  const local = arg("zip");
  if (local) return resolve(local);
  const cached = join(CACHE, "kfgqpc_warsh_v30.zip");
  if (existsSync(cached)) {
    log("zip", `cache ${cached}`);
    return cached;
  }
  if (OFFLINE) throw new IngestError("--offline mais aucun ZIP en cache");
  const url = arg("zip-url");
  if (!url) {
    throw new IngestError(
      "fournir --zip=<chemin local> ou --zip-url=<url directe du ZIP sur qurancomplex.gov.sa>",
    );
  }
  log("zip", `telechargement ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new IngestError(`telechargement echoue: HTTP ${res.status}`);
  mkdirSync(CACHE, { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(cached, buf);
  return cached;
}

function findCorpusRoot(out) {
  if (existsSync(join(out, KFGQPC.json.path))) return out;
  const nested = join(out, KFGQPC.id);
  if (existsSync(join(nested, KFGQPC.json.path))) return nested;
  return null;
}

function resolveCorpusRoot(out) {
  const root = findCorpusRoot(out);
  if (root) return root;
  const found = existsSync(out) ? readdirSync(out).join(", ") : "(repertoire absent)";
  throw new IngestError(
    `corpus introuvable sous ${out}.\n` +
      `  attendu ${join(out, KFGQPC.json.path)}\n` +
      `     ou ${join(out, KFGQPC.id, KFGQPC.json.path)}\n` +
      `  contenu reel: ${found}`,
  );
}

async function extractZip(zipPath) {
  const out = join(CACHE, "extracted");
  const deja = findCorpusRoot(out);
  if (deja) {
    log("zip", "deja extrait");
    return deja;
  }
  mkdirSync(out, { recursive: true });
  log("zip", "extraction");
  const ps = `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${out}' -Force`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
  return resolveCorpusRoot(out);
}

const TIMINGS_CACHE = join(CACHE, "timings");

// --offline doit etre un vrai mode : jamais de reseau, lecture du cache obligatoire.
async function fetchJsonCached(url, cachePath) {
  if (existsSync(cachePath)) {
    log("timings", `cache ${cachePath}`);
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  if (OFFLINE) {
    throw new IngestError(`--offline mais aucune donnee en cache: ${cachePath}`);
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new IngestError(`HTTP ${res.status} sur ${url}`);
      const payload = await res.json();
      mkdirSync(dirname(cachePath), { recursive: true });
      writeJsonAtomic(cachePath, payload);
      return payload;
    } catch (error) {
      lastError = error;
      log("timings", `tentative ${attempt}/3 echouee: ${error.message}`);
    }
  }
  throw new IngestError(`telechargement timings impossible: ${lastError.message}`);
}

async function main() {
  const zipPath = await resolveZip();
  const digest = await sha256File(zipPath);
  if (digest !== KFGQPC.zipSha256) {
    throw new IngestError(
      `SHA-256 du ZIP inattendu.\n  attendu ${KFGQPC.zipSha256}\n  obtenu  ${digest}`,
    );
  }
  log("zip", "SHA-256 conforme");

  const root = await extractZip(zipPath);
  const jsonPath = join(root, KFGQPC.json.path);
  const ttfPath = join(root, KFGQPC.ttf.path);
  for (const [p, expected] of [
    [jsonPath, KFGQPC.json.md5],
    [ttfPath, KFGQPC.ttf.md5],
  ]) {
    if (!existsSync(p)) throw new IngestError(`fichier absent dans le ZIP: ${p}`);
    const got = md5Hex(readFileSync(p));
    if (got !== expected) throw new IngestError(`MD5 inattendu pour ${p}: ${got}`);
  }
  log("zip", "JSON et TTF conformes");

  const rows = JSON.parse(readFileSync(jsonPath, "utf8"));
  const parsed = parseKfgqpc(rows);
  log("texte", `${parsed.meta.ayahCount} ayat, ${parsed.meta.surahCount} sourates`);

  for (const surah of parsed.surahs) {
    const expected = surahCounts[String(surah.n)];
    if (surah.a.length !== expected) {
      throw new IngestError(
        `sourate ${surah.n}: ${surah.a.length} ayat, ${expected} attendus d'apres la fixture`,
      );
    }
  }
  log("texte", "comptes de sourate conformes a la fixture");

  const cmp = compareWithQuranMeta(rows, warsh);
  if (cmp.pageDiffs.length > 0) {
    throw new IngestError(
      `${cmp.pageDiffs.length} ecarts de page avec quran-meta (attendu 0). Premier: ${cmp.pageDiffs[0].ayah}`,
    );
  }
  log("corroboration", "0 ecart de page avec quran-meta");

  const actual = cmp.juzDiffs
    .map((d) => ({ ayah: d.ayah, kfc: d.kfc, meta: d.meta }))
    .sort((a, b) => a.ayah.localeCompare(b.ayah, "en", { numeric: true }));
  const expected = [...divergence].sort((a, b) => a.ayah.localeCompare(b.ayah, "en", { numeric: true }));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new IngestError(
      `les ecarts de juz ont change.\n  attendu ${expected.length}\n  obtenu  ${actual.length}`,
    );
  }
  log("corroboration", `${actual.length} ecarts de juz, identiques a la fixture`);

  const reciter = selectReciter(arg("reciter"));
  const timingsDir = join(DATA, "timings", String(reciter.id));
  const audioBase = arg("audio-base") ?? AUDIO_BASE;
  const precisionCounts = { exact: 0, partial: 0, estimated: 0 };
  const surahReports = [];
  const audioUrls = {};

  for (const surah of parsed.surahs) {
    const url = TIMINGS_ENDPOINT.replace("{surah}", String(surah.n)).replace(
      "{reciter}",
      String(reciter.id),
    );
    const payload = await fetchJsonCached(
      url,
      join(TIMINGS_CACHE, String(reciter.id), `${surah.n}.json`),
    );
    // La reponse est un TABLEAU PLAT d'ayat (pas [{surah, ayahs}]). Le champ `audio`
    // n'existe pas : l'URL se reconstruit depuis le serveur du moshaf declare au manifeste.
    const ayat = normalizeTimings(payload);
    const info = classifyTimings({ ayahs: ayat, canonicalCount: surah.a.length });

    // `read=120` est le moshaf Warsh ; l'API ne valide pas la correspondance texte/timing,
    // c'est donc l'invariant qu'on tient, pas l'API.
    const audioUrl = `${audioBase}/${String(surah.n).padStart(3, "0")}.mp3`;
    audioUrls[String(surah.n)] = audioUrl;

    // On ne conserve que le prefixe contigu 1..k renvoye par l'API. Un trou interne
    // ou une numerotation etrangere a la riwaya ne doivent surtout pas produire de
    // doublon ni de desordre quand la queue estimee est concatenee.
    const inRange = ayat
      .filter((a) => a.ayah >= 1 && a.ayah <= surah.a.length)
      .sort((a, b) => a.ayah - b.ayah);

    let rowsOut = inRange.slice(0, info.coveredMax).map((a) => [a.ayah, a.startTime, a.endTime]);

    const durationMs = ayat.length > 0 ? Math.max(...ayat.map((a) => a.endTime)) : 0;

    if (info.missingTail > 0 && durationMs === 0) {
      throw new IngestError(
        `sourate ${surah.n}: ${info.missingTail} ayat sans timing et aucune duree connue, ` +
          `impossible d'estimer. Verifier la couverture de l'API pour cette sourate.`,
      );
    }
    if (info.missingTail > 0) {
      const tail = estimateTail({
        durationMs,
        coveredMax: info.coveredMax,
        canonicalCount: surah.a.length,
        wordsOf: (n) => surah.a[n - 1]?.[2]?.trim().split(/\s+/).length ?? 1,
      });
      rowsOut = rowsOut.concat(tail);
    }
    if (rowsOut.length !== surah.a.length) {
      throw new IngestError(
        `sourate ${surah.n}: ${rowsOut.length} lignes de timing, ${surah.a.length} attendues`,
      );
    }

    writeJsonAtomic(join(timingsDir, `${surah.n}.json`), {
      surah: surah.n,
      reciter: reciter.id,
      audioUrl,
      precision: info.precision,
      durationMs,
      ayat: rowsOut,
      // Geometrie conservee telle quelle : `null` pour les 26 ayat sans polygone, que
      // l'UI traitera en degrade gracieux plutot que de refusesur d'afficher l'ayah.
      geometry: Object.fromEntries(
        inRange.map((a) => [a.ayah, { polygon: a.polygon, page: a.page, x: a.x, y: a.y }]),
      ),
    });

    precisionCounts[info.precision] += 1;
    surahReports.push({
      surah: surah.n,
      precision: info.precision,
      coveredMax: info.coveredMax,
      canonical: surah.a.length,
      missingGeometry: info.missingGeometry,
    });
  }
  log("timings", JSON.stringify(precisionCounts));

  const geometryGaps = surahReports.flatMap((r) =>
    r.missingGeometry.map((a) => ({ surah: r.surah, ayah: a })),
  );
  if (geometryGaps.length > 0) {
    log("timings", `${geometryGaps.length} ayat sans polygone (timings conserves)`);
  }

  writeJsonAtomic(join(DATA, "quran-warsh.json"), parsed);

  writeJsonAtomic(join(DATA, "meta.json"), {
    riwaya: "warsh",
    source: {
      id: KFGQPC.id,
      publisher: KFGQPC.publisher,
      portalUrl: KFGQPC.portalUrl,
      license: KFGQPC.license,
      licenseNote: KFGQPC.licenseNote,
      zipSha256: KFGQPC.zipSha256,
      jsonMd5: KFGQPC.json.md5,
      ttfMd5: KFGQPC.ttf.md5,
    },
    counts: {
      ayahs: parsed.meta.ayahCount,
      surahs: parsed.meta.surahCount,
      pages: parsed.meta.pageCount,
      juz: parsed.meta.juzCount,
    },
    reciters: RECITERS,
    surahs: parsed.surahs.map((s) => ({
      n: s.n,
      en: s.en,
      ar: s.ar,
      ayahs: s.a.length,
      juzFrom: s.a[0][0],
      juzTo: s.a[s.a.length - 1][0],
      pageFrom: s.a[0][1],
      pageTo: s.a[s.a.length - 1][1],
    })),
  });

  // Pas d'horodatage ici : ce rapport est versionne et l'ingest doit rester idempotent
  // byte-identique. La date d'execution apparait uniquement dans les logs.
  writeJsonAtomic(join(DATA, "ingest-report.json"), {
    node: process.version,
    counts: parsed.meta,
    corroboration: {
      pages: { diffs: cmp.pageDiffs.length },
      juz: { diffs: cmp.juzDiffs, total: cmp.juzDiffs.length },
    },
    timings: { reciter: reciter.id, audioBase, precisionCounts, surahs: surahReports },
    audioUrls,
  });

  const fontDir = join(ROOT, "src", "assets", "fonts");
  mkdirSync(fontDir, { recursive: true });
  copyFileSync(ttfPath, join(fontDir, "kfgqpc_warsh_v30.ttf"));
  log("police", "kfgqpc_warsh_v30.ttf copiee");

  log("fin", "ingest reussi");
}

main().catch((error) => {
  process.stderr.write(`\n[ingest:ECHEC] ${error.message}\n`);
  process.exitCode = 1;
});
