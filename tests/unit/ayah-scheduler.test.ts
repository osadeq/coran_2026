// Plan 2, T-C — preuve du contrat « gap 0 » de l'ordonnanceur a relais.
// Environnement node pur : le AudioContext est un faux enregistreur injecte ; chaque
// start(when) est capte, et c'est le test qui declenche manuellement les onended
// (dans le vrai navigateur, l'horloge ctx les produirait).
import { describe, expect, it, vi } from "vitest";
import {
  createAyahScheduler,
  type AyahRef,
  type AudioBufferLike,
  type AudioContextLike,
  type BufferSourceLike,
} from "../../src/audio/ayah-scheduler";

class FakeSource implements BufferSourceLike {
  buffer: AudioBufferLike | null = null;
  readonly startCalls: number[] = [];
  stopped = false;
  disconnected = false;
  connected = false;
  onended: (() => void) | null = null;

  connect(): void {
    this.connected = true;
  }
  disconnect(): void {
    this.disconnected = true;
  }
  start(when = 0): void {
    this.startCalls.push(when);
  }
  stop(): void {
    this.stopped = true;
  }
  /** Simule la fin de lecture de cette piste (horloge reelle dans le navigateur). */
  fireEnded(): void {
    this.onended?.();
  }
}

class FakeCtx implements AudioContextLike {
  currentTime = 0;
  readonly destination: unknown = { fake: "destination" };
  readonly sources: FakeSource[] = [];
  readonly calls = { resume: 0, suspend: 0 };

  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  async resume(): Promise<void> {
    this.calls.resume += 1;
  }
  async suspend(): Promise<void> {
    this.calls.suspend += 1;
  }
}

const ayat: AyahRef[] = [
  { surah: 112, ayah: 1 },
  { surah: 112, ayah: 2 },
  { surah: 112, ayah: 3 },
  { surah: 112, ayah: 4 },
];
const durations = [1.0, 1.5, 2.0, 0.5];

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeRig() {
  const ctx = new FakeCtx();
  const getDecoded = vi.fn(async (ref: AyahRef): Promise<AudioBufferLike> => ({
    duration: durations[ref.ayah - 1],
  }));
  const onAyah: number[] = [];
  const onDone = vi.fn();
  const onPlaying: boolean[] = [];
  const scheduler = createAyahScheduler({
    ctx,
    getDecoded,
    ayat,
    onAyahChange: (i) => onAyah.push(i),
    onDone,
    onPlayingChange: (p) => onPlaying.push(p),
  });
  return { ctx, getDecoded, onAyah, onDone, onPlaying, scheduler };
}

describe("gap 0 (chaining du playhead)", () => {
  it("chaque verset demarre exactement a la fin du precedent", async () => {
    const { ctx, scheduler } = makeRig();
    ctx.currentTime = 10;
    await scheduler.play();
    await flush();

    const starts = ctx.sources.map((s) => s.startCalls[0]);
    expect(starts).toHaveLength(1);
    expect(starts[0]).toBe(10);

    ctx.sources[0].fireEnded();
    await flush();
    ctx.sources[1].fireEnded();
    await flush();
    ctx.sources[2].fireEnded();
    await flush();

    const all = ctx.sources.map((s) => s.startCalls[0]);
    expect(all).toHaveLength(4);
    // Egalite EXACTE, pas de tolerance : gap = next.startAt - (prev.startAt + prev.duration).
    expect(all[1] - all[0]).toBe(durations[0]);
    expect(all[2] - all[1]).toBe(durations[1]);
    expect(all[3] - all[2]).toBe(durations[2]);
  });

  it("bornes de piste : connecte la destination, une seule fois par verset", async () => {
    const { ctx, scheduler } = makeRig();
    await scheduler.play();
    await flush();
    ctx.sources[0].fireEnded();
    await flush();
    expect(ctx.sources[1].connected).toBe(true);
    expect(ctx.sources[1].buffer?.duration).toBe(durations[1]);
    expect(ctx.sources[1].startCalls).toHaveLength(1);
  });
});

describe("sequence et arret", () => {
  it("emets 0,1,2,3 puis onDone une fois, playing false, plus aucune piste", async () => {
    const { ctx, scheduler, onAyah, onDone } = makeRig();
    await scheduler.play();
    await flush();
    for (let i = 0; i < 4; i++) {
      ctx.sources[i].fireEnded();
      await flush();
    }
    expect(onAyah).toEqual([0, 1, 2, 3]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(scheduler.playing).toBe(false);
    expect(ctx.sources).toHaveLength(4);
    // Un onended tardif du dernier ne relance rien.
    ctx.sources[3].fireEnded();
    await flush();
    expect(ctx.sources).toHaveLength(4);
  });
});

describe("relai avec cartouche suivante prete (profondeur 1)", () => {
  it("decode N+1 pendant que N joue, jamais N+2", async () => {
    const { ctx, scheduler, getDecoded } = makeRig();
    await scheduler.play();
    await flush();
    // Verset 0 en jeu : 0 et 1 decodes, PAS encore 2.
    expect(getDecoded.mock.calls.map((c) => c[0].ayah)).toEqual([1, 2]);

    ctx.sources[0].fireEnded();
    await flush();
    expect(getDecoded.mock.calls.map((c) => c[0].ayah)).toEqual([1, 2, 3]);

    // Deja decode : rejouer la fin du verset 1 ne re-decode pas.
    ctx.sources[1].fireEnded();
    await flush();
    expect(getDecoded.mock.calls.map((c) => c[0].ayah)).toEqual([1, 2, 3, 4]);
  });
});

describe("pause / reprise par suspend-resume", () => {
  it("pause gèle l'horloge ; reprise continue la chaine sans re-ordonnancer", async () => {
    const { ctx, scheduler } = makeRig();
    await scheduler.play();
    await flush();
    expect(ctx.calls.resume).toBe(1);

    await scheduler.pause();
    expect(ctx.calls.suspend).toBe(1);
    expect(scheduler.playing).toBe(false);

    await scheduler.play();
    expect(ctx.calls.resume).toBe(2);
    expect(scheduler.playing).toBe(true);
    // La pause n'a pas cree de piste ni stoppe celle en cours.
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].stopped).toBe(false);

    // La chaine reprend : la fin du verset 0 enchainé sur 1.
    ctx.sources[0].fireEnded();
    await flush();
    expect(ctx.sources).toHaveLength(2);
  });

  it("toggle alterne playing", async () => {
    const { scheduler } = makeRig();
    await scheduler.toggle();
    expect(scheduler.playing).toBe(true);
    await scheduler.toggle();
    expect(scheduler.playing).toBe(false);
  });
});

describe("seek vers un verset", () => {
  it("stoppe la piste en vol, recale le playhead, reprend a la cible", async () => {
    const { ctx, scheduler, getDecoded } = makeRig();
    await scheduler.play();
    await flush();
    ctx.currentTime = 7;
    await scheduler.seekIndex(2);
    await flush();

    expect(ctx.calls.suspend).toBe(1);
    expect(ctx.sources[0].stopped).toBe(true);
    expect(ctx.sources[0].disconnected).toBe(true);
    // La 2e piste est le verset 2 (duration 2.0) demarre au currentTime, pas a l'ancien playhead.
    expect(ctx.sources[1].buffer?.duration).toBe(2.0);
    expect(ctx.sources[1].startCalls[0]).toBe(7);
    // Le verset 1 (index 1) n'est jamais joue apres un seek par-dessus lui...
    ctx.sources[1].fireEnded();
    await flush();
    expect(ctx.sources[2].buffer?.duration).toBe(0.5);
    expect(scheduler.index).toBe(3);
    void getDecoded;
    // ...mais il avait ete pre-decode (profondeur 1) : seul 4 est decode apres seek.
    const decoded = getDecoded.mock.calls.map((c) => c[0].ayah);
    expect(decoded).toEqual([1, 2, 3, 4]);

    // onended de la piste STOPPEE (generation obsolete) ne relance rien.
    const before = ctx.sources.length;
    ctx.sources[0].fireEnded();
    await flush();
    expect(ctx.sources).toHaveLength(before);
  });

  it("seek en pause = repositionne sans demarrer", async () => {
    const { ctx, scheduler, onAyah } = makeRig();
    await scheduler.pause(); // jamais joué : no-op propre
    await scheduler.seekIndex(1);
    expect(onAyah.at(-1)).toBe(1);
    expect(scheduler.index).toBe(1);
    expect(scheduler.playing).toBe(false);
    expect(ctx.sources).toHaveLength(0);
    expect(ctx.calls.suspend).toBe(0);
  });
});

describe("seek pendant une pause puis reprise", () => {
  // Bug reel : la pause gele l'horloge (clockSuspended), le seek en pause stoppe
  // la piste en vol, et la reprise se contentait de degeler une horloge sans
  // piste : Lecture affichee, aucun son, chaine morte.
  it("la reprise ordonnance le verset cible au lieu de degeler une piste stoppee", async () => {
    const { ctx, scheduler, onAyah } = makeRig();
    await scheduler.play();
    await flush();
    await scheduler.pause();

    ctx.currentTime = 4;
    await scheduler.seekIndex(2);
    expect(ctx.sources[0].stopped).toBe(true);

    await scheduler.play();
    await flush();

    expect(scheduler.playing).toBe(true);
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[1].buffer?.duration).toBe(2.0);
    expect(ctx.sources[1].startCalls[0]).toBe(4);
    expect(onAyah.at(-1)).toBe(2);

    // La chaine continue normalement apres la cible.
    ctx.sources[1].fireEnded();
    await flush();
    expect(ctx.sources[2].buffer?.duration).toBe(0.5);
    expect(scheduler.index).toBe(3);
  });
});

describe("repeter (hifz)", () => {
  it("avec repeat, chaque fin rejoue le MEME verset, sans onDone ni re-decodage", async () => {
    const { ctx, scheduler, getDecoded, onDone, onAyah } = makeRig();
    scheduler.setRepeat(true);
    expect(scheduler.getRepeating()).toBe(true);
    await scheduler.play();
    await flush();

    ctx.sources[0].fireEnded();
    await flush();
    // La 2e piste rejoue le verset 1 (duration 1.0), pas le suivant.
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[1].buffer?.duration).toBe(1.0);
    expect(onDone).not.toHaveBeenCalled();
    expect(onAyah).toEqual([0, 0]);
    // Gap 0 conserve dans la repetition : le creneau suit le precedent.
    expect(ctx.sources[1].startCalls[0] - ctx.sources[0].startCalls[0]).toBe(1.0);
    // Le buffer est reutilise depuis la memoire, pas re-decode.
    expect(getDecoded.mock.calls.map((c) => c[0].ayah)).toEqual([1, 2]);

    ctx.sources[1].fireEnded();
    await flush();
    expect(ctx.sources).toHaveLength(3);
    expect(ctx.sources[2].buffer?.duration).toBe(1.0);

    // Repeat coupe : la fin de la 3e piste (verset 1) enchaîne verset 2, puis jusqu'au bout.
    scheduler.setRepeat(false);
    ctx.sources[2].fireEnded();
    await flush();
    expect(ctx.sources).toHaveLength(4);
    expect(ctx.sources[3].buffer?.duration).toBe(1.5); // verset 2
    ctx.sources[3].fireEnded();
    await flush();
    expect(ctx.sources[4].buffer?.duration).toBe(2.0); // verset 3
    ctx.sources[4].fireEnded();
    await flush();
    expect(ctx.sources[5].buffer?.duration).toBe(0.5); // verset 4
    ctx.sources[5].fireEnded();
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(scheduler.playing).toBe(false);
    // Reutilisation sans re-decodage : 1 et 2 decodes au debut, puis 3 et 4 au fil de l'eau.
    expect(getDecoded.mock.calls.map((c) => c[0].ayah)).toEqual([1, 2, 3, 4]);
  });
});

describe("step, no-op, destroy", () => {
  it("step nave et naît aux bornes", async () => {
    const { scheduler } = makeRig();
    await scheduler.step(1);
    expect(scheduler.index).toBe(1);
    await scheduler.step(1);
    await scheduler.step(1);
    expect(scheduler.index).toBe(3);
    await scheduler.step(1);
    expect(scheduler.index).toBe(3); // borne haute
    await scheduler.step(-99);
    expect(scheduler.index).toBe(0); // borne basse
  });

  it("play deux fois = une reprise ; pause deux fois = une gelée", async () => {
    const { ctx, scheduler } = makeRig();
    await scheduler.play();
    await scheduler.play();
    expect(ctx.calls.resume).toBe(1);
    expect(ctx.sources).toHaveLength(1);
    await scheduler.pause();
    await scheduler.pause();
    expect(ctx.calls.suspend).toBe(1);
  });

  it("destroy stoppe et neutralise les onended tardifs", async () => {
    const { ctx, scheduler } = makeRig();
    await scheduler.play();
    await flush();
    scheduler.destroy();
    expect(ctx.sources[0].stopped).toBe(true);
    const before = ctx.sources.length;
    ctx.sources[0].fireEnded();
    await flush();
    expect(ctx.sources).toHaveLength(before);
  });
});
