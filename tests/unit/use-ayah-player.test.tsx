/**
 * @vitest-environment jsdom
 */
// Plan 2, T-D — le hook pilote l'ordonnanceur a relais de T-C. Il n'y a plus de
// <audio> ni de currentTime : chaque verset est un mp3 distinct, joue par une source
// Web Audio que le scheduler enchaîne a la fin de la precedente.
//
// Le faux AudioContext enregistre les start(when) ; c'est le test qui declenche les
// onended a la main (dans le navigateur, l'horloge ctx les produirait). Les octets
// sont injectes par `fetchBytes` : aucun Cache Storage, aucun reseau.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAyahPlayer } from "../../src/audio/use-ayah-player";

const DURATIONS = [1.0, 1.5, 2.0, 0.5];

class FakeSource {
  buffer: { duration: number } | null = null;
  readonly startCalls: number[] = [];
  stopped = false;
  onended: (() => void) | null = null;
  connect(): void {}
  disconnect(): void {}
  start(when = 0): void {
    this.startCalls.push(when);
  }
  stop(): void {
    this.stopped = true;
  }
  /** Fin de lecture simulee (l'horloge reelle la produirait dans le navigateur). */
  fireEnded(): void {
    this.onended?.();
  }
}

class FakeCtx {
  currentTime = 0;
  readonly destination: unknown = { fake: "destination" };
  readonly sources: FakeSource[] = [];
  readonly calls = { resume: 0, suspend: 0 };
  private decoded = 0;

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
  /** L'ordre des decodages suit l'ordre de prefetch des versets. */
  async decodeAudioData(): Promise<{ duration: number }> {
    const d = DURATIONS[this.decoded] ?? 1;
    this.decoded += 1;
    return { duration: d };
  }
}

function makeRig(ayahCount = 4) {
  const ctx = new FakeCtx();
  // Constructeur (et non fleche) : le hook fait `new Ctor()`.
  function AudioContextFactory(this: unknown) {
    return ctx;
  }
  const AudioContextClass = vi.fn(AudioContextFactory);
  const fetchBytes = vi.fn(async (_url: string) => new ArrayBuffer(8));
  const onAyah = vi.fn();
  const render = (props: Record<string, unknown> = {}) =>
    renderHook(
      (p: Record<string, unknown>) =>
        useAyahPlayer({
          reciterId: 1,
          surah: 112,
          ayahCount,
          // Plan 3, T6 : la riwaya participe a la cle de redemarrage, donc le
          // helper la fournit — un test peut l'ecarter pour simuler la bascule.
          riwaya: "warsh",
          AudioContextClass,
          fetchBytes,
          onAyah,
          ...p,
        } as never),
      { initialProps: props },
    );
  return { ctx, AudioContextClass, fetchBytes, onAyah, render };
}

/** Laisse les awaits du scheduler (memo -> decode) se vider. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAyahPlayer sur l'ordonnanceur a relais", () => {
  it("ne cree pas d'AudioContext au rendu (politique autoplay)", () => {
    const { AudioContextClass, render } = makeRig();
    const { result } = render();

    expect(AudioContextClass).not.toHaveBeenCalled();
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it("play() cree le contexte et demande les octets du verset 1", async () => {
    const { ctx, fetchBytes, onAyah, render } = makeRig();
    const { result } = render();

    await act(async () => {
      await result.current.play();
    });
    await settle();

    expect(result.current.playing).toBe(true);
    expect(ctx.calls.resume).toBeGreaterThan(0);
    expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("112001.mp3"));
    expect(ctx.sources.length).toBe(1);
    expect(onAyah).toHaveBeenCalledWith(0);
  });

  // Symptome 1 : la lecture doit s'enchainer sans arret a la fin de chaque mp3.
  it("enchaîne le verset suivant a la fin du precedent", async () => {
    const { ctx, fetchBytes, render } = makeRig();
    const { result } = render();

    await act(async () => {
      await result.current.play();
    });
    await settle();
    expect(ctx.sources.length).toBe(1);

    act(() => {
      ctx.sources[0].fireEnded();
    });
    await settle();

    expect(ctx.sources.length).toBe(2);
    expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("112002.mp3"));
  });

  // Symptome 2 : chaque verset joue doit etre signale pour la surbrillance.
  it("signale chaque verset lu a l'ecoute", async () => {
    const { ctx, onAyah, render } = makeRig();
    const { result } = render();

    await act(async () => {
      await result.current.play();
    });
    await settle();

    for (let i = 0; i < 3; i++) {
      act(() => {
        ctx.sources[i].fireEnded();
      });
      await settle();
    }

    expect(onAyah.mock.calls.map((c) => c[0])).toEqual([0, 1, 2, 3]);
    expect(result.current.index).toBe(3);
  });

  it("s'arrete a la fin de la liste", async () => {
    const { ctx, render } = makeRig();
    const { result } = render();

    await act(async () => {
      await result.current.play();
    });
    await settle();

    for (let i = 0; i < 4; i++) {
      act(() => {
        ctx.sources[i]?.fireEnded();
      });
      await settle();
    }

    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it("pause() suspend l'horloge et play() la reprend", async () => {
    const { ctx, render } = makeRig();
    const { result } = render();

    await act(async () => {
      await result.current.play();
    });
    await settle();

    await act(async () => {
      await result.current.pause();
    });
    expect(ctx.calls.suspend).toBe(1);
    expect(result.current.playing).toBe(false);

    await act(async () => {
      await result.current.play();
    });
    expect(ctx.calls.resume).toBeGreaterThanOrEqual(2);
    expect(result.current.playing).toBe(true);
  });

  it("seekAyah() positionne sur le verset demande (1-based)", async () => {
    const { onAyah, render } = makeRig();
    const { result } = render();

    await act(async () => {
      await result.current.seekAyah(3);
    });
    await settle();

    expect(result.current.index).toBe(2);
    expect(onAyah).toHaveBeenCalledWith(2);
  });

  it("next/prev avancent et reculent d'un verset", async () => {
    const { render } = makeRig();
    const { result } = render();

    await act(async () => {
      await result.current.seekAyah(2);
    });
    await settle();

    await act(async () => {
      await result.current.next();
    });
    await settle();
    expect(result.current.index).toBe(2);

    await act(async () => {
      await result.current.prev();
    });
    await settle();
    expect(result.current.index).toBe(1);
  });

  it("bascule la repetition", () => {
    const { render } = makeRig();
    const { result } = render();

    act(() => {
      result.current.setRepeat(true);
    });
    expect(result.current.repeat).toBe(true);

    act(() => {
      result.current.setRepeat(false);
    });
    expect(result.current.repeat).toBe(false);
  });

  // Changer de sourate est un geste explicite : « je veux ecouter celle-la ».
  // La lecture repart meme si l'utilisateur n'a jamais rien lance, et meme s'il
  // avait mis en pause. C'est la difference avec un changement de recitant, qui
  // ne relance que si la lecture tournait deja.
  describe("changement de sourate", () => {
    it("lance la lecture depuis le verset 1 sans geste precedent", async () => {
      const { ctx, fetchBytes, render } = makeRig();

      // Aucun play() : l'utilisateur ouvre l'app et choisit directement une sourate.
      const { result, rerender } = render({ surah: 112 });
      expect(result.current.playing).toBe(false);

      rerender({ surah: 1 });
      await settle();
      await settle();

      expect(result.current.playing).toBe(true);
      expect(result.current.index).toBe(0);
      expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("001001.mp3"));
      expect(ctx.sources.length).toBeGreaterThan(0);
    });

    // `position` vaut 0 quand la sourate change ; si le hook reintroduisait un jour
    // `indexRef.current`, la nouvelle sourate demarrerait au milieu.
    it("repart du verset 1 et non de la position courante", async () => {
      const { ctx, render } = makeRig();

      const { result, rerender } = render({ surah: 112 });
      await act(async () => {
        await result.current.play();
      });
      await settle();
      act(() => {
        ctx.sources[0].fireEnded();
      });
      await settle();
      act(() => {
        ctx.sources[1].fireEnded();
      });
      await settle();
      expect(result.current.index).toBe(2);

      rerender({ surah: 1 });
      await settle();
      await settle();

      expect(result.current.index).toBe(0);
      expect(result.current.playing).toBe(true);
    });

    it("relance aussi apres une pause volontaire", async () => {
      const { ctx, render } = makeRig();

      const { result, rerender } = render({ surah: 112 });
      await act(async () => {
        await result.current.play();
      });
      await settle();
      await act(async () => {
        await result.current.pause();
      });
      expect(result.current.playing).toBe(false);

      rerender({ surah: 1 });
      await settle();
      await settle();

      expect(result.current.playing).toBe(true);
      expect(result.current.index).toBe(0);
    });

    // La reconstruction doit rester propre : l'ancienne piste est tuee et le
    // nouveau repertoire est celui de la nouvelle sourate, sans appel a play().
    it("arrete l'ancienne piste et bascule sur la nouvelle sourate", async () => {
      const { ctx, fetchBytes, render } = makeRig();

      const { result, rerender } = render({ surah: 112 });
      await act(async () => {
        await result.current.play();
      });
      await settle();
      const firstSource = ctx.sources[0];

      rerender({ surah: 1 });
      await settle();
      await settle();

      expect(firstSource.stopped).toBe(true);
      expect(result.current.index).toBe(0);
      expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("001001.mp3"));
    });

    // Contrepartie du montage : l'autoplay ne doit PAS deborder sur le chargement de
    // la page, ou le navigateur refuserait de demarrer le contexte. `lastKeyRef` est
    // initialise avec la cle courante, donc le premier effet se voit "meme lecture"
    // alors qu'aucune lecture n'a demarre.
    it("ne lance rien au premier rendu", async () => {
      const { AudioContextClass, fetchBytes, render } = makeRig();

      const { result } = render({ surah: 112 });
      await settle();
      await settle();

      expect(AudioContextClass).not.toHaveBeenCalled();
      expect(result.current.playing).toBe(false);
      expect(fetchBytes).not.toHaveBeenCalled();
    });
  });

  // Plan 3, T6 — 64 sourates sur 114 ont le meme nombre de versets dans les deux
  // corpus : sans la riwaya dans la cle de redemarrage, un changement de mode
  // laisserait `memeLecture` vrai, donc la position serait conservee et la lecture
  // ne redemarrerait pas — l'inverse du comportement demande. La sourate 1
  // (7 versets des deux cotes) est le cas de test le plus net ; nommer la
  // condition dans le titre empeche de « simplifier » le test plus tard en
  // choisissant une sourate ou les comptes different.
  describe("changement de riwaya", () => {
    it("repart du verset 1 quand la riwaya change sur une sourate de meme longueur", async () => {
      const { fetchBytes, render } = makeRig(7); // sourate 1 : 7 versets dans les deux corpus
      const { result, rerender } = render({ surah: 1 });

      await act(async () => {
        await result.current.play();
      });
      await settle();
      await act(async () => {
        await result.current.seekAyah(5);
      });
      await settle();
      expect(result.current.index).toBe(4);

      // Sans ceci, le verset 1 aurait deja ete demande au demarrage et
      // l'assertion suivante passerait meme sans redemarrage.
      fetchBytes.mockClear();
      rerender({ surah: 1, riwaya: "hafs" });
      await settle();
      await settle();

      expect(result.current.index).toBe(0);
      expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("001001.mp3"));
    });

    it("repart du verset 1 en pause quand la riwaya change sur une sourate de meme longueur", async () => {
      const { fetchBytes, render } = makeRig(7);
      const { result, rerender } = render({ surah: 1 });

      await act(async () => {
        await result.current.play();
      });
      await settle();
      await act(async () => {
        await result.current.seekAyah(5);
      });
      await settle();
      await act(async () => {
        await result.current.pause();
      });
      expect(result.current.index).toBe(4);
      expect(result.current.playing).toBe(false);

      fetchBytes.mockClear();
      rerender({ surah: 1, riwaya: "hafs" });
      await settle();
      await settle();

      expect(result.current.index).toBe(0);
      expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("001001.mp3"));
    });
  });

  // Point 1 de correction.txt : choisir un autre recitant doit changer la voix.
  // Le test suivant couvre la reprise de la lecture ; celui-ci verifie seulement que
  // le repertoire du nouveau recitant est bien celui qu'on telecharge.
  it("changer de recitant : nouvelle source sur le repertoire du nouveau recitant", async () => {
    const { ctx, fetchBytes, render } = makeRig();

    const { result, rerender } = render({ reciterId: 1 });
    await act(async () => {
      await result.current.play();
    });
    await settle();
    expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("warsh_Abdul_Basit_128kbps"));
    const firstSource = ctx.sources[0];

    rerender({ reciterId: 2 });
    await settle();

    expect(firstSource.stopped).toBe(true);
    // Depuis la T2, l'id 2 est le recitant Hafs Husary : l'ancien dossier
    // warsh_ibrahim_aldosary etait defectueux (404) et a ete retire du manifeste.
    expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("Husary_128kbps"));
  });

  // Point 2 de correction.txt : changer de recitant en plein playback ne doit pas
  // couper la lecture. Elle repart sur la nouvelle voix, au verset ou l'on etait.
  it("changer de recitant pendant la lecture reprend au verset courant", async () => {
    const { ctx, fetchBytes, onAyah, render } = makeRig();

    const { result, rerender } = render({ reciterId: 1 });
    await act(async () => {
      await result.current.play();
    });
    await settle();

    // Deux versets ont joue : la lecture est arrivee au verset 3 (index 2).
    act(() => {
      ctx.sources[0].fireEnded();
    });
    await settle();
    act(() => {
      ctx.sources[1].fireEnded();
    });
    await settle();
    expect(result.current.index).toBe(2);

    const oldSource = ctx.sources[2];
    expect(oldSource.stopped).toBe(false);
    fetchBytes.mockClear();
    onAyah.mockClear();

    rerender({ reciterId: 2 });
    await settle();
    await settle();

    // L'ancienne piste est arretee, et la nouvelle voix joue bien le verset 3.
    expect(oldSource.stopped).toBe(true);
    expect(result.current.playing).toBe(true);
    expect(result.current.index).toBe(2);
    expect(onAyah).toHaveBeenCalledWith(2);
    // Id 2 = Hafs Husary depuis la T2 (voir le test precedent).
    expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("Husary_128kbps"));
    expect(fetchBytes).toHaveBeenCalledWith(expect.stringContaining("112003.mp3"));
    expect(fetchBytes).not.toHaveBeenCalledWith(expect.stringContaining("112001.mp3"));
    expect(ctx.sources[ctx.sources.length - 1].buffer).not.toBeNull();
  });

  // Contrepartie : changer de recitant alors qu'on ne joue pas ne doit PAS
  // demarrer un son que l'utilisateur n'attendait pas.
  it("changer de recitant en pause reste en pause", async () => {
    const { ctx, fetchBytes, render } = makeRig();

    const { result, rerender } = render({ reciterId: 1 });
    await act(async () => {
      await result.current.play();
    });
    await settle();
    act(() => {
      ctx.sources[0].fireEnded();
    });
    await settle();

    await act(async () => {
      await result.current.pause();
    });
    expect(result.current.playing).toBe(false);
    const sourcesBefore = ctx.sources.length;
    fetchBytes.mockClear();

    rerender({ reciterId: 2 });
    await settle();
    await settle();

    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(1);
    expect(ctx.sources.length).toBe(sourcesBefore);
    expect(fetchBytes).not.toHaveBeenCalled();
  });


  // Bug reel : changer de recitant en pause detruit l'ordonnanceur ; celui que
  // Lecture reconstruit repartait de son index neuf (verset 1) au lieu de la
  // position conservee par le hook.
  describe("reprise sur un ordonnanceur reconstruit", () => {
    async function pausedAfterOneVerse(rig: ReturnType<typeof makeRig>) {
      const view = rig.render({ reciterId: 1 });
      await act(async () => {
        await view.result.current.play();
      });
      await settle();
      act(() => {
        rig.ctx.sources[0].fireEnded();
      });
      await settle();
      await act(async () => {
        await view.result.current.pause();
      });
      return view;
    }

    it("recitant change en pause puis Lecture : reprend au verset courant", async () => {
      const rig = makeRig();
      const { result, rerender } = await pausedAfterOneVerse(rig);
      rerender({ reciterId: 2 });
      await settle();
      rig.fetchBytes.mockClear();

      await act(async () => {
        await result.current.play();
      });
      await settle();

      expect(result.current.playing).toBe(true);
      expect(result.current.index).toBe(1);
      expect(rig.fetchBytes).toHaveBeenCalledWith(expect.stringContaining("Husary_128kbps"));
      expect(rig.fetchBytes).toHaveBeenCalledWith(expect.stringContaining("112002.mp3"));
      expect(rig.fetchBytes).not.toHaveBeenCalledWith(expect.stringContaining("112001.mp3"));
    });

    it("recitant change en pause, repositionnement, puis Lecture : part du verset choisi", async () => {
      const rig = makeRig();
      const { result, rerender } = await pausedAfterOneVerse(rig);
      rerender({ reciterId: 2 });
      await settle();
      await act(async () => {
        await result.current.seekAyah(4);
      });
      expect(result.current.index).toBe(3);
      rig.fetchBytes.mockClear();

      await act(async () => {
        await result.current.play();
      });
      await settle();

      expect(result.current.playing).toBe(true);
      expect(result.current.index).toBe(3);
      expect(rig.fetchBytes).toHaveBeenCalledWith(expect.stringContaining("112004.mp3"));
      expect(rig.fetchBytes).not.toHaveBeenCalledWith(expect.stringContaining("112001.mp3"));
    });

    it("verset choisi avant toute lecture : Lecture part de ce verset", async () => {
      const rig = makeRig();
      const { result } = rig.render();
      await act(async () => {
        await result.current.seekAyah(3);
      });

      await act(async () => {
        await result.current.play();
      });
      await settle();

      expect(result.current.index).toBe(2);
      expect(rig.fetchBytes).toHaveBeenCalledWith(expect.stringContaining("112003.mp3"));
      expect(rig.fetchBytes).not.toHaveBeenCalledWith(expect.stringContaining("112001.mp3"));
    });
  });
});
