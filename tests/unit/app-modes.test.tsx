/**
 * @vitest-environment jsdom
 */
// Plan 3, T7 — la bascule Warsh/Hafs relie tout : titre, corpus, timings,
// selecteur de recitant et reprise au verset 1. jsdom n'a ni Web Audio ni
// Cache Storage : les doublures globales ci-dessous laissent toute la chaine
// jouer sans reseau, et le faux cache enregistre les URL demandees — c'est la
// seule trace audio disponible pour verifier qu'aucune URL n'est hors corpus.
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";

const requestedUrls: string[] = [];

// La jauge porte le verset courant dans un champ : on recompose « N / total ».
const positionText = () => {
  const box = screen.getByTestId("player-position");
  const input = box.querySelector("input");
  return `${input?.value ?? ""}${box.textContent ?? ""}`.trim();
};

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect(): void {}
  disconnect(): void {}
  start(): void {}
  stop(): void {}
}

class FakeAudioContext {
  currentTime = 0;
  destination: unknown = { fake: "destination" };
  createBufferSource(): FakeSource {
    return new FakeSource();
  }
  async resume(): Promise<void> {}
  async suspend(): Promise<void> {}
  async close(): Promise<void> {}
  async decodeAudioData(): Promise<{ duration: number }> {
    return { duration: 1 };
  }
}

// Cache toujours en hit : pas de fetch, et chaque URL enregistree.
const fakeCache = {
  async match(url: string): Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }> {
    requestedUrls.push(url);
    return { arrayBuffer: async () => new ArrayBuffer(8) };
  },
  async put(): Promise<void> {},
};

beforeEach(() => {
  vi.clearAllMocks();
  requestedUrls.length = 0;
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as Record<string, unknown>).AudioContext = FakeAudioContext;
  (globalThis as Record<string, unknown>).caches = { open: async () => fakeCache };
});

/** Vide les microtaches du scheduler (memo -> decode -> play). */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function chooseSurah(n: number): Promise<void> {
  fireEvent.change(screen.getByTitle("Sourate"), { target: { value: String(n) } });
  await settle();
}

async function switchMode(mode: "warsh" | "hafs"): Promise<void> {
  fireEvent.change(screen.getByTestId("player-riwaya"), { target: { value: mode } });
  await settle();
}

describe("App — modes Warsh et Hafs", () => {
  it("titre dynamique : Coran — Warsh au demarrage, Coran — Hafs apres la bascule", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Coran — Warsh");

    await switchMode("hafs");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Coran — Hafs");
  });

  // Preuve que le CORPUS a change, pas seulement l'etiquette : la sourate 2
  // compte 285 ayat en Warsh et 286 en Hafs.
  it("le corpus suit le mode : 1 / 285 en Warsh puis 1 / 286 en Hafs sur la sourate 2", async () => {
    render(<App />);
    await chooseSurah(2);
    expect(positionText()).toBe("1 / 285");

    await switchMode("hafs");

    expect(positionText()).toBe("1 / 286");
  });

  // Le badge « durées estimées » du plan ne peut pas servir d'assertion : les
  // 114 fichiers timings sont precision "exact", il ne s'affiche donc jamais
  // (ecart consigne en T9 ; le critere de fin du plan — badge absent en Hafs —
  // reste couvert ci-dessous). Le gate se prouve sur aria-valuenow, sourate 1 :
  // 13240/56140 = 24 % avec la table Warsh, 1/7 = 14 % sans elle.
  it("les timings suivent le mode : table Warsh en Warsh, null en Hafs", async () => {
    render(<App />);
    const progress = screen.getByTestId("player-progress");
    await waitFor(() => expect(progress).toHaveAttribute("aria-valuenow", "24"));
    expect(screen.queryByText("durées estimées")).not.toBeInTheDocument();

    await switchMode("hafs");

    expect(screen.getByTestId("player-progress")).toHaveAttribute("aria-valuenow", "14");
    expect(screen.queryByText("durées estimées")).not.toBeInTheDocument();
  });

  it("selecteur de recitant absent en Warsh, present en Hafs dans l'application", async () => {
    render(<App />);
    expect(screen.queryByTestId("player-reciter")).not.toBeInTheDocument();

    await switchMode("hafs");

    const select = screen.getByTestId("player-reciter");
    expect(within(select).getAllByRole("option")).toHaveLength(7);
  });

  // Aucun geste Lecture : la bascule a lieu sur la sourate 2, ou l'autoplay de
  // changement de sourate a deja construit l'ordonnanceur Warsh.
  it("bascule sur la sourate 2 sans geste Lecture : aucun verset hors total", async () => {
    render(<App />);
    await chooseSurah(2);

    await switchMode("hafs");

    const position = positionText();
    const [courant, total] = position.split("/").map((s) => Number(s.trim()));
    expect(total).toBe(286);
    expect(courant).toBeGreaterThanOrEqual(1);
    expect(courant).toBeLessThanOrEqual(total);
    expect(screen.getByTestId("ayah-286")).toBeInTheDocument();
    expect(screen.queryByTestId("ayah-287")).not.toBeInTheDocument();
  });

  // Seule asymetrie des deux corpus : la sourate 5 a 122 ayat en Warsh, 120 en
  // Hafs. Ni le DOM ni la chaine audio ne doivent garder la valeur de 122.
  it("sourate 5 : 122 ayat en Warsh puis 120 en Hafs, sans verset ni URL hors range", async () => {
    render(<App />);
    await chooseSurah(5);
    expect(positionText()).toBe("1 / 122");
    expect(screen.getByTestId("ayah-122")).toBeInTheDocument();

    await switchMode("hafs");

    expect(positionText()).toBe("1 / 120");
    expect(screen.queryByTestId("ayah-121")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ayah-122")).not.toBeInTheDocument();

    // La chaine audio a bien tourne cote Hafs (sinon la boucle suivante est
    // vide et ne prouve rien), et aucune URL sourate 5 ne depasse 120.
    expect(
      requestedUrls.some((u) => u.includes("Husary_128kbps/005001.mp3")),
    ).toBe(true);
    for (const url of requestedUrls) {
      const m = /\/005(\d{3})\.mp3$/.exec(url);
      if (m) expect(Number(m[1])).toBeLessThanOrEqual(120);
    }
  });
});
