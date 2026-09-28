import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { silentWav } from "./wav";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const timings = (surah: number) =>
    JSON.parse(readFileSync(join(ROOT, "src", "data", "timings", "120", `${surah}.json`), "utf8")) as {
    durationMs: number;
    precision: string;
    ayat: [number, number, number][];
  };

// Le motif doit survivre au changement d'hote et de repertoire de la tache 0
// (`Rewayat-Warsh-A-n-Nafi/112.mp3` ne passe PAS sous `**/husr/*.mp3`).
//
// Ecart #6 vs le plan : le `route.fulfill` 200 du plan rend l'audio NON
// navigable. Chromium, sur un `src` media, requiert des octets par Range
// (`Range: bytes=N-`) des qu'on seek ; une reponse 200-full-corps a une
// requete range est invalide -> l'element garde `seekable = [0-0]` et
// n'importe quel `currentTime = N` est ramene a 0 (`seeking@0`/`seeked@0`,
// sonde e2e 2026-09-28). On sert donc un 206 avec `Content-Range` quand la
// requete porte un Range, comme le ferait le vrai serveur mp3quran.
async function stubAudio(page: import("@playwright/test").Page, surah: number) {
  const wav = silentWav(timings(surah).durationMs);
  await page.route("**/*.mp3", (route) => {
    const range = route.request().headers()["range"];
    if (!range) {
      return route.fulfill({
        status: 200,
        contentType: "audio/wav",
        headers: { "Accept-Ranges": "bytes" },
        body: wav,
      });
    }
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), wav.length - 1) : wav.length - 1;
    return route.fulfill({
      status: 206,
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${wav.length}`,
      },
      body: wav.subarray(start, end + 1),
    });
  });
}

/**
 * `fill()` est invalide sur `input[type=range]`. On ecrase la valeur via le
 * setter natif, sinon React ignore l'evenement (il compare a sa valeur
 * memorisee), puis on dispatche `input` et `change`.
 */
async function seekTo(page: import("@playwright/test").Page, seconds: number) {
  await page.getByTestId("player-seek").evaluate((el, s) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, String(s));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, seconds);
}

async function waitForMetadata(page: import("@playwright/test").Page) {
  await page.getByTestId("player-audio").evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const audio = el as HTMLAudioElement;
        if (audio.readyState >= 1) return resolve();
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => resolve(), { once: true });
      }),
  );
}

test.describe("lecteur", () => {
  test("affiche la sourate 112 en RTL avec ses 4 ayahs", async ({ page }) => {
    await stubAudio(page, 112);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");
    await expect(page.locator(".ayah")).toHaveCount(4);
    await expect(page.getByTestId("ayah-1-text")).toHaveAttribute("dir", "rtl");
  });

  test("surligne l'ayah correspondant a la position", async ({ page }) => {
    await stubAudio(page, 112);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");
    await waitForMetadata(page);

    const target = timings(112).ayat[2]; // 3e ayah
    const seconds = (target[1] + 200) / 1000;
    await seekTo(page, seconds);

    await expect(page.getByTestId(`ayah-${target[0]}`)).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("ayah-1")).toHaveAttribute("data-active", "false");
  });

  // Les deux branches assertent : le test ne peut pas devenir vide.
  test("le badge est present exactement quand la precision n'est pas exacte", async ({ page }) => {
    const precision = timings(7).precision;
    await stubAudio(page, 7);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "7");

    const badge = page.locator(".badge");
    if (precision === "exact") {
      await expect(badge).toHaveCount(0);
    } else {
      await expect(badge).toBeVisible();
    }
  });
});
