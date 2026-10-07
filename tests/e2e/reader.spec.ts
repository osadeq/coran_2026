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
    // La selection d'une sourate LANCE la lecture (autoplay voulu, voir CLAUDE.md) :
    // un clic sur Lecture la mettrait en pause. L'ecriture d'origine (commit
    // 8023029) datait d'avant l'autoplay et ce clic n'existait que pour demarrer.
    await page.selectOption('select[aria-label="Sourate"]', "112");

    await expect(page.getByTestId("player-play")).toHaveAttribute("aria-label", "Pause");
    await expect(page.getByTestId("ayah-1")).toHaveAttribute("data-active", "true");

    // expect.poll avec intervals serres : le stub de 300 ms rend la fenetre
    // d'affichage de chaque verset ~250 ms, plus courte que l'intervalle de
    // re-essai de toHaveAttribute (voir plus bas ~500 ms) — l'assertion rate
    // la fenetre de ayah-4 alors que la lecture avance bien (sonde verifiee).
    await expect
      .poll(async () => page.getByTestId("ayah-4").getAttribute("data-active"), {
        timeout: 10000,
        intervals: [100, 150, 200, 300],
        message: "ayah-4 ne devient jamais actif pendant l'auto-avance",
      })
      .toBe("true");

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

  // La jauge de position : la frappe « 40 » ne saute pas au verset 4 en
  // chemin, seule la validation (Entree) engage le saut.
  test("saut au verset saisi dans la jauge de position", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "2");

    const input = page.getByTestId("player-position").getByRole("spinbutton");
    await input.click();
    await input.press("Control+a");
    await input.pressSequentially("40");
    await expect(page.getByTestId("ayah-4")).not.toHaveAttribute("data-active", "true");
    await input.press("Enter");

    await expect(page.getByTestId("ayah-40")).toHaveAttribute("data-active", "true");
    await expect(input).toHaveValue("40");
  });

  test("saut au verset clique dans la barre de progression", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "2");

    const bar = page.getByTestId("player-progress");
    const box = await bar.boundingBox();
    if (!box) throw new Error("barre de progression absente");
    await bar.click({ position: { x: box.width / 2, y: box.height / 2 } });

    // Milieu de la sourate 2 (285 ayat) : bien au-dela du debut, avant la fin.
    const input = page.getByTestId("player-position").getByRole("spinbutton");
    await expect.poll(async () => Number(await input.inputValue())).toBeGreaterThan(100);
    expect(Number(await input.inputValue())).toBeLessThan(200);
    const verse = await input.inputValue();
    await expect(page.getByTestId(`ayah-${verse}`)).toHaveAttribute("data-active", "true");
  });

  test("saut pendant une pause puis Lecture : la lecture repart du verset cible", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");
    await expect(page.getByTestId("player-play")).toHaveAttribute("aria-label", "Pause");

    await page.getByTestId("player-play").click();
    await expect(page.getByTestId("player-play")).toHaveAttribute("aria-label", "Lire");

    const bar = page.getByTestId("player-progress");
    const box = await bar.boundingBox();
    if (!box) throw new Error("barre de progression absente");
    await bar.click({ position: { x: 2, y: box.height / 2 } });
    await expect(page.getByTestId("ayah-1")).toHaveAttribute("data-active", "true");

    await page.getByTestId("player-play").click();
    await expect(page.getByTestId("player-play")).toHaveAttribute("aria-label", "Pause");
    await expect
      .poll(async () => page.getByTestId("ayah-4").getAttribute("data-active"), {
        timeout: 10000,
        intervals: [100, 150, 200, 300],
        message: "la lecture ne repart pas apres un saut en pause",
      })
      .toBe("true");
  });

  test("mode répétition (repeat)", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");

    await page.getByTestId("player-repeat").click();
    await expect(page.getByTestId("player-repeat")).toHaveAttribute("aria-pressed", "true");

    // Pas de clic sur Lecture : la selection de la sourate joue deja (autoplay).
    // Cliquer dessus basculerait en pause et la repetition ne se manifesterait plus.
    await page.getByTestId("ayah-4").click();

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

    // Autoplay : la selection a deja relance la lecture depuis le cache ; le clic
    // sur Lecture (ecriture d'avant-autoplay) l'aurait mise en pause ici.
    await expect(page.getByTestId("player-play")).toHaveAttribute("aria-label", "Pause");
    // Meme intervals serres que pour ayah-4 : la fenetre du verset 2 dure
    // ~250 ms (stub de 300 ms), trop courte pour l'intervalle de toHaveAttribute.
    await expect
      .poll(async () => page.getByTestId("ayah-2").getAttribute("data-active"), {
        timeout: 5000,
        intervals: [100, 150, 200, 300],
        message: "ayah-2 ne devient jamais actif depuis le cache",
      })
      .toBe("true");

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

  // Plan 3, T9 etape 5 : le navigateur est le seul controle du rendu. Le test
  // unitaire de cmap prouve que la police COUVRE les 69 codepoints ; celui-ci
  // prouve qu'elle est bien CHARGEE et APPLIQUEE au verset en mode Hafs — les
  // deux ensemble excluent les carres vides.
  test("le mode Hafs applique et charge la police Amiri Quran", async ({ page }) => {
    await stubVerseAudio(page);
    await page.goto("/");
    await page.selectOption('select[aria-label="Sourate"]', "112");
    await page.selectOption('[data-testid="player-riwaya"]', "hafs");

    await expect(page.locator("main")).toHaveAttribute("data-riwaya", "hafs");

    const applied = await page.evaluate(async () => {
      await document.fonts.ready;
      const el = document.querySelector(".ayah-text");
      if (!el) return { family: "", loaded: false };
      return {
        family: getComputedStyle(el).fontFamily,
        loaded: document.fonts.check('1em "Amiri Quran"'),
      };
    });
    expect(applied.family).toMatch(/^"Amiri Quran"/);
    expect(applied.loaded, "police Amiri Quran non chargee par le navigateur").toBe(true);
  });
});
