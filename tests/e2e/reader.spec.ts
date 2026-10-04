import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { silentWav } from "./wav";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const getTimings = (surah: number) =>
  JSON.parse(
    readFileSync(join(ROOT, "src", "data", "timings", "120", `${surah}.json`), "utf8")
  ) as { precision: string };

async function stubVerseAudio(page: import("@playwright/test").Page) {
  const shortWav = silentWav(300);
  await page.route("**/*.mp3", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "audio/wav",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: shortWav,
    });
  });
}

test.describe("lecteur par verset", () => {
  test("affiche la sourate 112 en RTL avec ses 4 ayahs", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");
    await expect(page.locator(".ayah")).toHaveCount(4);
    await expect(page.getByTestId("ayah-1-text")).toHaveAttribute("dir", "rtl");
  });

  test("avance automatiquement du verset 1 au verset 4 lors de la lecture", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");

    await page.getByTestId("player-play").click();

    await expect(page.getByTestId("ayah-1")).toHaveAttribute("data-active", "true");

    await expect(page.getByTestId("ayah-4")).toHaveAttribute("data-active", "true", { timeout: 10000 });

    await expect(page.getByTestId("player-play")).toHaveAttribute("aria-label", "Lire", { timeout: 5000 });
  });

  test("centrage du verset actif dans le viewport", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "2");

    await page.getByTestId("ayah-40").click();
    await expect(page.getByTestId("ayah-40")).toHaveAttribute("data-active", "true");

    const box = await page.getByTestId("ayah-40").boundingBox();
    const viewportSize = page.viewportSize();
    if (box && viewportSize) {
      const centerY = box.y + box.height / 2;
      const targetCenter = viewportSize.height / 2;
      expect(Math.abs(centerY - targetCenter)).toBeLessThan(150);
    }
  });

  test("mode répétition (repeat)", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");

    await page.getByTestId("player-repeat").click();
    await expect(page.getByTestId("player-repeat")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("ayah-4").click();
    await page.getByTestId("player-play").click();

    await expect(page.getByTestId("ayah-4")).toHaveAttribute("data-active", "true");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("ayah-4")).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("player-play")).toHaveAttribute("aria-label", "Pause");
  });

  test("lecture hors-ligne via le cache Storage après téléchargement", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");

    await page.getByTestId("download-surah").click();
    await expect(page.getByTestId("download-progress")).toBeVisible();
    await expect(page.getByTestId("download-progress")).toHaveAttribute("aria-valuenow", "4", { timeout: 10000 });

    let networkMp3Requests = 0;
    await page.route("**/*.mp3", (route) => {
      networkMp3Requests++;
      return route.abort();
    });

    await page.reload();
    await page.selectOption('select[aria-label="Sourate"]', "112");

    networkMp3Requests = 0;

    await page.getByTestId("player-play").click();
    await expect(page.getByTestId("ayah-1")).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("ayah-2")).toHaveAttribute("data-active", "true", { timeout: 5000 });

    expect(networkMp3Requests).toBe(0);
  });

  test("le badge durées estimées est présent uniquement quand la précision n'est pas exacte", async ({ page }) => {
    const precision = getTimings(112).precision;
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");

    const badge = page.locator(".badge");
    if (precision === "exact") {
      await expect(badge).toHaveCount(0);
    } else {
      await expect(badge).toBeVisible();
    }
  });
});
