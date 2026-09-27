/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncEngine } from "../../src/sync/use-sync-engine";

const rows = [
  [1, 0, 1000],
  [2, 1000, 2000],
  [3, 2000, 3000],
] as const;

describe("useSyncEngine", () => {
  beforeEach(() => {
    // rAF are stubbed and the clock is faked: without both, the loop is not drivable.
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 16) as unknown as number,
    );
    vi.stubGlobal("cancelAnimationFrame", (h: number) => clearTimeout(h));
  });

  afterEach(() => {
    // unstubs d'abord : useFakeTimers a installe les faux rAF/cAF avant stubGlobal, donc
    // unstubAllGlobals les remetrait apres useRealTimers et le unmount de cleanup()
    // appellerait un cancelAnimationFrame a horloge deposee.
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rapporte le premier ayah des la premiere image", () => {
    const audio = { currentTime: 0 } as HTMLAudioElement;
    const seen: (number | null)[] = [];
    renderHook(() => useSyncEngine(audio, rows, (a) => seen.push(a)));

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(seen).toEqual([1]);
  });

  it("signale le changement d'ayah quand currentTime avance", () => {
    const audio = { currentTime: 0 } as HTMLAudioElement;
    const seen: (number | null)[] = [];
    renderHook(() => useSyncEngine(audio, rows, (a) => seen.push(a)));

    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      audio.currentTime = 1.5;
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(seen).toEqual([1, 2]);
  });

  it("ne rappelle pas le callback si l'ayah n'a pas change", () => {
    const audio = { currentTime: 0.2 } as HTMLAudioElement;
    const onAyah = vi.fn();
    renderHook(() => useSyncEngine(audio, rows, onAyah));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 1er ayah signale une fois, puis plus rien malgre plusieurs images
    expect(onAyah).toHaveBeenCalledTimes(1);
    expect(onAyah).toHaveBeenCalledWith(1);
  });

  it("reste muet avant le premier ayah", () => {
    const audio = { currentTime: 0 } as HTMLAudioElement;
    const onAyah = vi.fn();
    const late = [
      [1, 500, 1000],
      [2, 1000, 2000],
    ] as const;
    renderHook(() => useSyncEngine(audio, late, onAyah));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onAyah).not.toHaveBeenCalled();
  });
});
