/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PlayerBar, type PlayerBarProps } from "../../src/components/PlayerBar";
import { AYAH_RECITERS, rewayaReciters } from "../../scripts/lib/manifest.mjs";
import type { SurahTimings } from "../../src/types";

describe("PlayerBar", () => {
  const dummyTimings: SurahTimings = {
    surah: 112,
    reciter: 120,
    audioUrl: "",
    precision: "estimated",
    durationMs: 12000,
    ayat: [
      [1, 0, 3000],
      [2, 3000, 6000],
      [3, 6000, 9000],
      [4, 9000, 12000],
    ],
    geometry: {},
  };

  // Plan 3, T7 : chaque test ne declare que ce qu'il observe — riwaya et
  // onRiwaya ont une valeur par defaut comme le reste des props.
  const renderBar = (overrides: Partial<PlayerBarProps> = {}) => {
    const onReciter = vi.fn();
    const onRiwaya = vi.fn();
    const props: PlayerBarProps = {
      reciters: AYAH_RECITERS as PlayerBarProps["reciters"],
      reciter: 1,
      onReciter,
      playing: false,
      currentIndex: 0,
      totalAyat: 4,
      repeat: false,
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onToggleRepeat: vi.fn(),
      timings: dummyTimings,
      riwaya: "warsh",
      onRiwaya,
      ...overrides,
    };
    const view = render(<PlayerBar {...props} />);
    return { ...view, props, onReciter, onRiwaya };
  };

  it("affiche la position '1 / 4' et le sélecteur de récitant par défaut sur Abdul Basit", () => {
    const { onReciter } = renderBar();

    expect(screen.getByTestId("player-position")).toHaveTextContent("1 / 4");

    const select = screen.getByTestId("player-reciter") as HTMLSelectElement;
    expect(select.value).toBe("1");
    // Le composant rend la liste recue : c'est App qui la filtre par riwaya (T7),
    // d'ou les 8 entrees de la table globale quand on les passe toutes.
    expect(select.options).toHaveLength(8);

    fireEvent.change(select, { target: { value: "2" } });
    expect(onReciter).toHaveBeenCalledWith(2);
  });

  it("gère les clics sur play, prev, next et repeat", () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onToggleRepeat = vi.fn();

    const { rerender, props } = renderBar({
      onPlay,
      onPause,
      onPrev,
      onNext,
      onToggleRepeat,
    });

    const playBtn = screen.getByTestId("player-play");
    expect(playBtn).toHaveAttribute("aria-label", "Lire");
    fireEvent.click(playBtn);
    expect(onPlay).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("player-next"));
    expect(onNext).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("player-prev"));
    expect(onPrev).toHaveBeenCalled();

    const repeatBtn = screen.getByTestId("player-repeat");
    expect(repeatBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(repeatBtn);
    expect(onToggleRepeat).toHaveBeenCalled();

    rerender(<PlayerBar {...props} playing={true} currentIndex={1} repeat={true} />);

    expect(screen.getByTestId("player-play")).toHaveAttribute("aria-label", "Pause");
    expect(screen.getByTestId("player-position")).toHaveTextContent("2 / 4");
    expect(screen.getByTestId("player-repeat")).toHaveAttribute("aria-pressed", "true");
  });

  it("affiche le badge 'durées estimées' quand la précision n'est pas exact", () => {
    const { rerender, props } = renderBar();

    expect(screen.getByText("durées estimées")).toBeInTheDocument();

    const exactTimings: SurahTimings = {
      ...dummyTimings,
      precision: "exact",
    };

    rerender(<PlayerBar {...props} timings={exactTimings} />);

    expect(screen.queryByText("durées estimées")).not.toBeInTheDocument();
  });

  // Point 3 de correction.txt : un bouton sans `title` n'explique rien au survol —
  // sur des icones emoji comme ⏮ ▶ ⏭, c'est la seule legende lisible.
  const BOUTONS = ["player-prev", "player-play", "player-next", "player-repeat"];

  it("donne un title non vide a chaque bouton, au selecteur de recitant et au selecteur de mode", () => {
    renderBar();

    for (const id of BOUTONS) {
      const title = screen.getByTestId(id).getAttribute("title");
      expect(title, `title manquant ou vide sur ${id}`).toBeTruthy();
    }
    expect(screen.getByTestId("player-reciter").getAttribute("title")).toBeTruthy();
    // Plan T7 : le nouveau select entre dans le meme contrat de survol.
    expect(screen.getByTestId("player-riwaya").getAttribute("title")).toBeTruthy();
  });

  it("le title du bouton lecture suit l'etat (Lire / Pause)", () => {
    const { rerender, props } = renderBar();
    expect(screen.getByTestId("player-play")).toHaveAttribute("title", "Lire");

    rerender(<PlayerBar {...props} playing />);
    expect(screen.getByTestId("player-play")).toHaveAttribute("title", "Pause");
  });

  // Plan 3, T7 — quatre comportements du selecteur de mode : il existe dans les
  // deux modes, il annonce son etat par aria-label, il remonte le choix a
  // l'application, et il coexiste avec un select de recitant qui ne s'affiche
  // que quand le mode a plus d'une voix (Warsh en a une seule).
  describe("selecteur de mode", () => {
    const labels = (select: HTMLElement) =>
      within(select).getAllByRole("option").map((o) => o.textContent);

    it("existe dans les deux modes et propose exactement Warsh et Hafs", () => {
      const { rerender, props } = renderBar({ riwaya: "warsh" });

      const enWarsh = screen.getByTestId("player-riwaya") as HTMLSelectElement;
      expect(labels(enWarsh)).toEqual(["Warsh", "Hafs"]);
      expect(enWarsh.value).toBe("warsh");

      rerender(<PlayerBar {...props} riwaya="hafs" />);
      const enHafs = screen.getByTestId("player-riwaya") as HTMLSelectElement;
      expect(labels(enHafs)).toEqual(["Warsh", "Hafs"]);
      expect(enHafs.value).toBe("hafs");
    });

    it("masque le selecteur de recitant en Warsh (une seule voix) et l'affiche en Hafs (sept)", () => {
      const { rerender, props } = renderBar({
        riwaya: "warsh",
        reciters: rewayaReciters("warsh"),
      });
      expect(screen.queryByTestId("player-reciter")).toBeNull();

      rerender(<PlayerBar {...props} riwaya="hafs" reciters={rewayaReciters("hafs")} />);
      const select = screen.getByTestId("player-reciter");
      expect(labels(select)).toEqual(
        rewayaReciters("hafs").map((r: { labelFr: string }) => r.labelFr),
      );
    });

    it("appelle onRiwaya une fois quand on choisit Hafs", () => {
      const { onRiwaya } = renderBar();

      fireEvent.change(screen.getByTestId("player-riwaya"), { target: { value: "hafs" } });

      expect(onRiwaya).toHaveBeenCalledTimes(1);
      expect(onRiwaya).toHaveBeenCalledWith("hafs");
    });

    it("donne un aria-label explicite au selecteur de mode", () => {
      renderBar();
      expect(screen.getByTestId("player-riwaya").getAttribute("aria-label")).toBe("Lecture");
    });
  });
});
