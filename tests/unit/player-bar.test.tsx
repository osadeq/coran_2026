/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayerBar } from "../../src/components/PlayerBar";
import { AYAH_RECITERS } from "../../scripts/lib/manifest.mjs";
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

  it("affiche la position '1 / 4' et le sélecteur de récitant par défaut sur Abdul Basit", () => {
    const onReciter = vi.fn();
    render(
      <PlayerBar
        reciters={AYAH_RECITERS as any}
        reciter={1}
        onReciter={onReciter}
        playing={false}
        currentIndex={0}
        totalAyat={4}
        repeat={false}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToggleRepeat={vi.fn()}
        timings={dummyTimings}
      />
    );

    expect(screen.getByTestId("player-position")).toHaveTextContent("1 / 4");

    const select = screen.getByTestId("player-reciter") as HTMLSelectElement;
    expect(select.value).toBe("1");
    expect(select.options).toHaveLength(3);

    fireEvent.change(select, { target: { value: "2" } });
    expect(onReciter).toHaveBeenCalledWith(2);
  });

  it("gère les clics sur play, prev, next et repeat", () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onToggleRepeat = vi.fn();

    const { rerender } = render(
      <PlayerBar
        reciters={AYAH_RECITERS as any}
        reciter={1}
        onReciter={vi.fn()}
        playing={false}
        currentIndex={0}
        totalAyat={4}
        repeat={false}
        onPlay={onPlay}
        onPause={onPause}
        onPrev={onPrev}
        onNext={onNext}
        onToggleRepeat={onToggleRepeat}
      />
    );

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

    rerender(
      <PlayerBar
        reciters={AYAH_RECITERS as any}
        reciter={1}
        onReciter={vi.fn()}
        playing={true}
        currentIndex={1}
        totalAyat={4}
        repeat={true}
        onPlay={onPlay}
        onPause={onPause}
        onPrev={onPrev}
        onNext={onNext}
        onToggleRepeat={onToggleRepeat}
      />
    );

    expect(screen.getByTestId("player-play")).toHaveAttribute("aria-label", "Pause");
    expect(screen.getByTestId("player-position")).toHaveTextContent("2 / 4");
    expect(screen.getByTestId("player-repeat")).toHaveAttribute("aria-pressed", "true");
  });

  it("affiche le badge 'durées estimées' quand la précision n'est pas exact", () => {
    const { rerender } = render(
      <PlayerBar
        reciters={AYAH_RECITERS as any}
        reciter={1}
        onReciter={vi.fn()}
        playing={false}
        currentIndex={0}
        totalAyat={4}
        repeat={false}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToggleRepeat={vi.fn()}
        timings={dummyTimings}
      />
    );

    expect(screen.getByText("durées estimées")).toBeInTheDocument();

    const exactTimings: SurahTimings = {
      ...dummyTimings,
      precision: "exact",
    };

    rerender(
      <PlayerBar
        reciters={AYAH_RECITERS as any}
        reciter={1}
        onReciter={vi.fn()}
        playing={false}
        currentIndex={0}
        totalAyat={4}
        repeat={false}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToggleRepeat={vi.fn()}
        timings={exactTimings}
      />
    );

    expect(screen.queryByText("durées estimées")).not.toBeInTheDocument();
  });

  // Point 3 de correction.txt : un bouton sans `title` n'explique rien au survol —
  // sur des icones emoji comme ⏮ ▶ ⏭, c'est la seule legende lisible.
  const BOUTONS = ["player-prev", "player-play", "player-next", "player-repeat"];

  it("donne un title non vide a chaque bouton et au selecteur de recitant", () => {
    render(
      <PlayerBar
        reciters={AYAH_RECITERS as any}
        reciter={1}
        onReciter={vi.fn()}
        playing={false}
        currentIndex={0}
        totalAyat={4}
        repeat={false}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToggleRepeat={vi.fn()}
        timings={dummyTimings}
      />,
    );

    for (const id of BOUTONS) {
      const title = screen.getByTestId(id).getAttribute("title");
      expect(title, `title manquant ou vide sur ${id}`).toBeTruthy();
    }
    expect(screen.getByTestId("player-reciter").getAttribute("title")).toBeTruthy();
  });

  it("le title du bouton lecture suit l'etat (Lire / Pause)", () => {
    const props = {
      reciters: AYAH_RECITERS as any,
      reciter: 1,
      onReciter: vi.fn(),
      currentIndex: 0,
      totalAyat: 4,
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onToggleRepeat: vi.fn(),
      timings: dummyTimings,
    };
    const { rerender } = render(
      <PlayerBar {...props} playing={false} repeat={false} />,
    );
    expect(screen.getByTestId("player-play")).toHaveAttribute("title", "Lire");

    rerender(<PlayerBar {...props} playing repeat={false} />);
    expect(screen.getByTestId("player-play")).toHaveAttribute("title", "Pause");
  });
});
