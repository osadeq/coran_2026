/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerBar } from "../../src/components/PlayerBar";
import type { SurahTimings } from "../../src/types";

// Ecart au plan, exige par `npm run typecheck` (gate de la tache 12) : la fixule du plan
// omit le champ `geometry`, rendu OBLIGATOIRE dans `SurahTimings` par le commit 2f991d2, et
// son `precision: "exact"` etait inferé `string`. On annote donc en `SurahTimings` et on
// ajoute `geometry: {}`. Le reste de la fixule est identique au plan.
const timings: SurahTimings = {
  surah: 112,
  reciter: 120,
  audioUrl: "https://example.test/112.mp3",
  precision: "exact",
  durationMs: 40_000,
  ayat: [
    [1, 0, 10_000],
    [2, 10_000, 20_000],
    [3, 20_000, 30_000],
    [4, 30_000, 40_000],
  ],
  geometry: {},
};

const base = {
  timings,
  audioUrl: "https://example.test/112.mp3",
  reciters: [],
  reciter: 120,
  onReciter: () => {},
  onAyah: () => {},
};

describe("PlayerBar", () => {
  it("affiche la duree totale", () => {
    render(<PlayerBar {...base} />);
    expect(screen.getByTestId("player-duration")).toHaveTextContent("0:40");
  });

  it("bascule lecture / pause", async () => {
    const user = userEvent.setup();
    const play = vi.fn().mockResolvedValue(undefined);
    render(<PlayerBar {...base} play={play} />);
    await user.click(screen.getByRole("button", { name: /lire/i }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  // Un `input[type=range]` n'est pas un champ texte : `userEvent.type` n'y fait
  // rien. On passe par un evenement `change`, et l'interface expose des SECONDES
  // alors que `seek` recoit des MILLISECONDES. L'assertion doit donc porter sur
  // 15000, pas 15.
  it("convertit la position en secondes vers des millisecondes", () => {
    const seek = vi.fn();
    render(<PlayerBar {...base} seek={seek} />);
    fireEvent.change(screen.getByTestId("player-seek"), { target: { value: "15" } });
    expect(seek).toHaveBeenCalledWith(15_000);
  });

  it("remet la position a zero quand la sourate change", () => {
    const { rerender } = render(<PlayerBar {...base} />);
    fireEvent.change(screen.getByTestId("player-seek"), { target: { value: "15" } });
    expect(screen.getByTestId("player-position")).toHaveTextContent("0:15");

    rerender(<PlayerBar {...base} audioUrl="https://example.test/113.mp3" />);
    expect(screen.getByTestId("player-position")).toHaveTextContent("0:00");
  });

  it("signale une precision non exacte", () => {
    render(
      <PlayerBar
        {...base}
        timings={{ ...timings, precision: "estimated" }}
      />,
    );
    expect(screen.getByText(/estim/i)).toBeTruthy();
  });

  // La sourate 2 pese ~95 Mo. Toute degrade vers `fetch` + `blob:` tuerait l'onglet et
  // le mobile. Le streaming par requetes `Range` est assure nativement par <audio src> ;
  // ce test verrouille le choix, il n'a pas a simuler le navigateur.
  it("branche l'audio en streaming, sans telechargement ni blob", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<PlayerBar {...base} />);
    const audio = screen.getByTestId("player-audio") as HTMLAudioElement;
    expect(audio.getAttribute("src")).toBe("https://example.test/112.mp3");
    expect(audio.getAttribute("preload")).toBe("metadata");
    expect(audio.getAttribute("src") ?? "").not.toMatch(/^blob:/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
