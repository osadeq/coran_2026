/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AyahItem } from "../../src/components/AyahItem";
import { AyahList } from "../../src/components/AyahList";
import type { Surah } from "../../src/types";

describe("Ayah Centering & Follow Toggle", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  const dummySurah: Surah = {
    n: 112,
    en: "Al-Ikhlas",
    ar: "الإخلاص",
    a: [
      [30, 604, "قُلْ هُوَ اللَّهُ أَحَدٌ"],
      [30, 604, "اللَّهُ الصَّمَدُ"],
      [30, 604, "لَمْ يَلِدْ وَلَمْ يُولَدْ"],
      [30, 604, "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ"],
    ],
  };

  it("appelle scrollIntoView({ block: 'center', behavior: 'smooth' }) quand le verset est actif et follow=true", () => {
    const { rerender } = render(
      <AyahItem
        ayah={1}
        text="قُلْ هُوَ اللَّهُ أَحَدٌ"
        juz={30}
        page={604}
        active={false}
        follow={true}
        onSelect={vi.fn()}
      />
    );

    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    rerender(
      <AyahItem
        ayah={1}
        text="قُلْ هُوَ اللَّهُ أَحَدٌ"
        juz={30}
        page={604}
        active={true}
        follow={true}
        onSelect={vi.fn()}
      />
    );

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
  });

  it("n'appelle PAS scrollIntoView quand le suivi (follow) est désactivé", () => {
    render(
      <AyahItem
        ayah={1}
        text="قُلْ هُوَ اللَّهُ أَحَدٌ"
        juz={30}
        page={604}
        active={true}
        follow={false}
        onSelect={vi.fn()}
      />
    );

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("propose un bouton follow-toggle dans AyahList actif par défaut", () => {
    const { rerender } = render(
      <AyahList surah={dummySurah} activeAyah={1} onSelect={vi.fn()} />
    );

    const toggle = screen.getByTestId("follow-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    scrollIntoViewMock.mockReset();
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");

    rerender(<AyahList surah={dummySurah} activeAyah={2} onSelect={vi.fn()} />);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});
