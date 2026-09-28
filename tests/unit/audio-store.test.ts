// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import quranJson from "../../src/data/quran-warsh.json";
import { AYAH_RECITERS } from "../../scripts/lib/manifest.mjs";
import type { AyahReciter, QuranData } from "../../src/types";
import {
  CACHE_NAME,
  downloadUnit,
  getAyahBytes,
  listAyats,
  type DownloadProgress,
} from "../../src/audio/audio-store";

const quran = quranJson as unknown as QuranData;
const abdulBasit = (AYAH_RECITERS as readonly AyahReciter[]).find((r) => r.id === 1)!;

// jsdom n'implemente PAS Cache Storage : fake maison, la seule garantie testee ici est
// le contrat (hit -> pas de fetch, miss -> put, idempotence), pas le navigateur.
class FakeCache {
  store = new Map<string, Uint8Array>();

  async match(url: string): Promise<Response | undefined> {
    const bytes = this.store.get(url);
    return bytes ? new Response(bytes.slice()) : undefined;
  }

  // Cache.put reel recoit un Response ; le passer tel quel a `new Response(...)` le
  // stringifierait en "[object Response]" (15 octets parasites) — d'ou ce tri explicite.
  async put(url: string, body: BodyInit | Response): Promise<void> {
    const res = body instanceof Response ? body : new Response(body);
    this.store.set(url, new Uint8Array(await res.arrayBuffer()));
  }
}

let cache: FakeCache;
let fetchCalls: string[];
let fetchImpl: (url: string) => Promise<Response>;

beforeEach(() => {
  cache = new FakeCache();
  fetchCalls = [];
  fetchImpl = async (url) => {
    fetchCalls.push(url);
    return new Response(new Uint8Array([1, 2, 3, 4]));
  };
  vi.stubGlobal("caches", { open: async () => cache });
  vi.stubGlobal("fetch", (input: string) => fetchImpl(String(input)));
});

describe("listAyats", () => {
  it("une sourate = un verset par ligne, numerotes de 1 a n", () => {
    expect(listAyats(quran, { kind: "surah", n: 112 })).toEqual([
      { surah: 112, ayah: 1 },
      { surah: 112, ayah: 2 },
      { surah: 112, ayah: 3 },
      { surah: 112, ayah: 4 },
    ]);
    expect(listAyats(quran, { kind: "surah", n: 1 })).toHaveLength(7);
  });

  it("un juz = tous les (sourate, verset) dont row[0] le porte, tries par (s, a)", () => {
    const refs = listAyats(quran, { kind: "juz", j: 30 });
    // Chiffre releve sur le corpus committe (section 2 du plan) : le juz 30 compte 566 ayat.
    expect(refs).toHaveLength(566);
    for (const ref of refs) {
      expect(quran.surahs[ref.surah - 1].a[ref.ayah - 1][0]).toBe(30);
    }
    for (let i = 1; i < refs.length; i++) {
      const [p, c] = [refs[i - 1], refs[i]];
      const cmp = p.surah - c.surah || p.ayah - c.ayah;
      expect(cmp).toBeLessThan(0);
    }
  });

  it("refuse une sourate ou un juz inexistant", () => {
    expect(() => listAyats(quran, { kind: "surah", n: 115 })).toThrow(RangeError);
    expect(() => listAyats(quran, { kind: "juz", j: 0 })).toThrow(RangeError);
    expect(() => listAyats(quran, { kind: "juz", j: 31 })).toThrow(RangeError);
  });
});

describe("getAyahBytes", () => {
  it("miss : fetch puis mise en cache, et retourne les octets", async () => {
    const bytes = await getAyahBytes("https://x/y/112001.mp3");
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(fetchCalls).toEqual(["https://x/y/112001.mp3"]);
    expect(cache.store.has("https://x/y/112001.mp3")).toBe(true);
  });

  it("hit : les octets viennent du cache, aucun fetch", async () => {
    await getAyahBytes("https://x/y/112001.mp3");
    fetchCalls = [];
    const bytes = await getAyahBytes("https://x/y/112001.mp3");
    expect(fetchCalls).toEqual([]);
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("un put qui echoue (quota) ne casse pas la lecture", async () => {
    cache.put = async () => {
      throw new Error("QuotaExceededError");
    };
    const bytes = await getAyahBytes("https://x/y/112001.mp3");
    expect(new Uint8Array(bytes).length).toBe(4);
  });

  it("une reponse non-ok leve", async () => {
    fetchImpl = async () => new Response(null, { status: 404 });
    await expect(getAyahBytes("https://x/y/inexistant.mp3")).rejects.toThrow(/404/);
  });
});

describe("downloadUnit", () => {
  it("telecharge une sourate entiere : exactement les URLs NNNMMM paddees", async () => {
    const progress: DownloadProgress[] = [];
    const report = await downloadUnit(
      { kind: "surah", n: 112 },
      abdulBasit,
      quran,
      { onProgress: (p) => progress.push(p) },
    );
    const base = "https://everyayah.com/data/warsh/warsh_Abdul_Basit_128kbps/";
    expect([...cache.store.keys()].sort()).toEqual([
      `${base}112001.mp3`,
      `${base}112002.mp3`,
      `${base}112003.mp3`,
      `${base}112004.mp3`,
    ]);
    expect(report).toEqual({ fetched: 4, skipped: 0, bytes: 16 });
    expect(progress.at(-1)).toEqual({ done: 4, total: 4 });
    const dones = progress.map((p) => p.done);
    expect(dones).toEqual([...dones].sort((a, b) => a - b));
  });

  it("est idempotent : le second appel ne fait aucun fetch", async () => {
    await downloadUnit({ kind: "surah", n: 112 }, abdulBasit, quran);
    fetchCalls = [];
    const report = await downloadUnit({ kind: "surah", n: 112 }, abdulBasit, quran);
    expect(fetchCalls).toEqual([]);
    expect(report).toEqual({ fetched: 0, skipped: 4, bytes: 0 });
  });

  it("ne depasse jamais la concurrence demandee (4 en vol max sur 7 jobs)", async () => {
    let inflight = 0;
    let peak = 0;
    fetchImpl = async (url) => {
      fetchCalls.push(url);
      inflight += 1;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight -= 1;
      return new Response(new Uint8Array([1, 2, 3, 4]));
    };
    const report = await downloadUnit({ kind: "surah", n: 1 }, abdulBasit, quran);
    expect(report.fetched).toBe(7);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1); // sinon la file serait sequentielle, pas bornee
  });

  it("s'arrete si isAborted, sans laisser un job en vol de plus", async () => {
    let aborted = false;
    fetchImpl = async (url) => {
      fetchCalls.push(url);
      if (fetchCalls.length >= 2) aborted = true;
      await new Promise((r) => setTimeout(r, 2));
      return new Response(new Uint8Array([1, 2, 3, 4]));
    };
    const report = await downloadUnit({ kind: "surah", n: 1 }, abdulBasit, quran, {
      concurrency: 1,
      isAborted: () => aborted,
    });
    expect(report.fetched).toBeLessThan(7);
    expect(fetchCalls.length).toBeLessThanOrEqual(3);
  });
});

describe("nom du cache", () => {
  it("est fige (v1) — un changement de nom = purge involontaire du cache user", () => {
    expect(CACHE_NAME).toBe("coran-warsh-ayah-v1");
  });
});
