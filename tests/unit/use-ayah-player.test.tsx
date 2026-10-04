/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAyahPlayer } from "../../src/audio/use-ayah-player";
import type { AudioContextLike, BufferSourceLike } from "../../src/audio/ayah-scheduler";

class FakeSource implements BufferSourceLike {
  buffer = null;
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {}
  start() {}
  stop() {
    if (this.onended) this.onended();
  }
}

class FakeAudioContext implements AudioContextLike {
  static instancesCreated = 0;
  currentTime = 0;
  destination = {};
  state: "suspended" | "running" = "suspended";

  constructor() {
    FakeAudioContext.instancesCreated++;
  }

  createBufferSource() {
    return new FakeSource();
  }
  async suspend() {
    this.state = "suspended";
  }
  async resume() {
    this.state = "running";
  }
  async decodeAudioData() {
    return { duration: 1.5 };
  }
}

describe("useAyahPlayer", () => {
  beforeEach(() => {
    FakeAudioContext.instancesCreated = 0;
  });

  it("n'instancie pas l'AudioContext au premier rendu (lazy autoplay protection)", () => {
    const { result } = renderHook(() =>
      useAyahPlayer({
        reciterId: 1,
        surah: 112,
        ayahCount: 4,
        AudioContextClass: FakeAudioContext as unknown as new () => AudioContextLike,
        fetchBytes: async () => new ArrayBuffer(8),
      })
    );

    expect(FakeAudioContext.instancesCreated).toBe(0);
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it("crée l'AudioContext lors du premier appel à play()", async () => {
    const onAyah = vi.fn();
    const { result } = renderHook(() =>
      useAyahPlayer({
        reciterId: 1,
        surah: 112,
        ayahCount: 4,
        onAyah,
        AudioContextClass: FakeAudioContext as unknown as new () => AudioContextLike,
        fetchBytes: async () => new ArrayBuffer(8),
      })
    );

    await act(async () => {
      await result.current.play();
    });

    expect(FakeAudioContext.instancesCreated).toBe(1);
    expect(result.current.playing).toBe(true);
    expect(onAyah).toHaveBeenCalledWith(0);
  });

  it("permet de basculer la répétition et de faire seek", async () => {
    const { result } = renderHook(() =>
      useAyahPlayer({
        reciterId: 1,
        surah: 112,
        ayahCount: 4,
        AudioContextClass: FakeAudioContext as unknown as new () => AudioContextLike,
        fetchBytes: async () => new ArrayBuffer(8),
      })
    );

    act(() => {
      result.current.setRepeat(true);
    });
    expect(result.current.repeat).toBe(true);

    await act(async () => {
      await result.current.seekAyah(3); // 1-based -> index 2
    });

    expect(result.current.index).toBe(2);
  });

  it("réinitialise l'état et détruit le scheduler lors du changement de sourate", async () => {
    let surah = 112;
    const { result, rerender } = renderHook(() =>
      useAyahPlayer({
        reciterId: 1,
        surah,
        ayahCount: 4,
        AudioContextClass: FakeAudioContext as unknown as new () => AudioContextLike,
        fetchBytes: async () => new ArrayBuffer(8),
      })
    );

    await act(async () => {
      await result.current.play();
    });
    expect(result.current.playing).toBe(true);

    surah = 1;
    rerender();

    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(0);
  });
});
