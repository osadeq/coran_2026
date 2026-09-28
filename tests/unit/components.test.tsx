/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AyahList } from "../../src/components/AyahList";
import { SurahPicker } from "../../src/components/SurahPicker";

// Fixule = texte reel de la sourate 112 dans src/data/quran-warsh.json (commit 563e5b8).
// Le plan utilisait un texte de type Hafs et assertait ࣰ, ABSENT meme de sa propre
// fixule : l'echec etait garanti quel que soit le composant. Les codepoints etendus reels
// de l'ayah 4 sont U+0870, U+08F1, U+08CC — l'assertion porte desormais sur U+08F1.
const surah = {
  n: 112,
  en: "Al-Ikhlas",
  ar: "الإخلاص",
  a: [
    [30,604,"قُلْ هُوَ ࡰ۬للَّهُ أَحَدٌ࣌"],
    [30,604,"ࡴ۬للَّهُ ࡲ۬لصَّمَدُ࣌"],
    [30,604,"لَمْ يَلِدْ وَلَمْ يُولَدْ࣌"],
    [30,604,"وَلَمْ يَكُن لَّهُۥ كُفُؤاً ࡰحَدࣱ࣌"],
  ] as [number, number, string][],
};

describe("AyahList", () => {
  it("affiche tous les ayahs en RTL", () => {
    render(<AyahList surah={surah} activeAyah={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const text = screen.getByTestId("ayah-1-text");
    expect(text).toHaveAttribute("dir", "rtl");
    expect(text).toHaveAttribute("lang", "ar");
  });

  it("marque l'ayah actif", () => {
    render(<AyahList surah={surah} activeAyah={2} onSelect={() => {}} />);
    expect(screen.getByTestId("ayah-2")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("ayah-1")).toHaveAttribute("data-active", "false");
  });

  it("remonte la selection", async () => {
    const seen: number[] = [];
    render(<AyahList surah={surah} activeAyah={null} onSelect={(n) => seen.push(n)} />);
    await userEvent.click(screen.getByTestId("ayah-3"));
    expect(seen).toEqual([3]);
  });

  it("conserve les codepoints etendus du texte", () => {
    render(<AyahList surah={surah} activeAyah={null} onSelect={() => {}} />);
    expect(screen.getByTestId("ayah-4-text").textContent).toContain("ࣱ");
  });
});

describe("SurahPicker", () => {
  it("liste les 114 sourates", () => {
    render(<SurahPicker surahs={Array.from({ length: 114 }, (_, i) => ({ n: i + 1, en: `S${i + 1}`, ar: "", a: [] }))} value={1} onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(114);
  });
});
