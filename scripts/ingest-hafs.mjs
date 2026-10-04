#!/usr/bin/env node
import { writeJsonAtomic } from "./lib/io.mjs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const FIXTURES = join(ROOT, "scripts", "fixtures");

const CHAPTERS_URL = "https://api.quran.com/api/v4/chapters";
const VERSES_BY_CHAPTER_URL = (chapterId, page = 1) =>
  `https://api.quran.com/api/v4/verses/by_chapter/${chapterId}?fields=text_uthmani&page_numbers=true&juz_numbers=true&per_page=50&page=${page}`;

const RETRIES = 3;
const RETRY_DELAYS = [0, 500, 1000]; // ms backoff between attempts

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function fetchJsonWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetch(url);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.toLowerCase().includes("json")) {
        throw new Error(`HTTP ${res.status} ${res.statusText} sur ${url}`);
      }
      const payload = await res.json();
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        await sleep(RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1]);
      }
    }
  }
  throw new Error(
    lastError ? `${lastError.message}` : `echec apres ${RETRIES} tentatives pour ${url}`
  );
}

async function main() {
  const chaptersRes = await fetchJsonWithRetry(CHAPTERS_URL);
  const chapters = chaptersRes.chapters || [];

  const surahCounts = {};
  const surahMeta = [];
  for (let i = 0; i < chapters.length; i += 1) {
    const ch = chapters[i];
    const n = ch.id;
    surahCounts[String(n)] = ch.verses_count;
    surahMeta.push({
      n,
      en: ch.name_simple,
      ar: ch.name_arabic,
    });
  }

  const surahs = [];
  let totalAyah = 0;
  for (let n = 1; n <= 114; n += 1) {
    let allVerses = [];
    let page = 1;
    while (true) {
      const versesRes = await fetchJsonWithRetry(VERSES_BY_CHAPTER_URL(n, page));
      const verses = versesRes.verses || [];
      allVerses = allVerses.concat(verses);
      const pagination = versesRes.pagination;
      if (!pagination || !pagination.next_page || pagination.current_page === pagination.next_page) {
        break;
      }
      if (pagination.next_page && pagination.next_page > page) {
        page = pagination.next_page;
      } else {
        break;
      }
      await sleep(100);
    }

    const ayas = [];
    for (let v = 0; v < allVerses.length; v += 1) {
      const verse = allVerses[v];
      const juz = verse.juz_number;
      const pageNum = verse.page_number;
      const text = verse.text_uthmani;
      if (typeof text === "string" && text.length > 0) {
        ayas.push([juz, pageNum, text]);
      }
    }
    const meta = surahMeta.find((m) => m.n === n) || { n, en: "", ar: "" };
    surahs.push({
      n,
      en: meta.en,
      ar: meta.ar,
      a: ayas,
    });
    totalAyah += ayas.length;
    await sleep(100);
  }

  const corpus = {
    meta: {
      riwaya: "hafs",
      source: "api.quran.com/api/v4 (Tanzil uthmani)",
      ayahCount: totalAyah,
      surahCount: 114,
      pageCount: 604,
      juzCount: 30,
    },
    surahs,
  };

  writeJsonAtomic(join(DATA, "quran-hafs.json"), corpus);
  writeJsonAtomic(join(FIXTURES, "hafs-surah-counts.json"), surahCounts);

  console.log(`[ingest-hafs] ${surahs.length} surahs, ${totalAyah} versets`);
}

main().catch((error) => {
  process.stderr.write(`\n[ingest-hafs:ECHEC] ${error.message}\n`);
  process.exitCode = 1;
});
