import { useEffect, useRef, useState, useCallback } from "react";
import { selectAyahReciter } from "../../scripts/lib/manifest.mjs";
import { ayahUrl } from "./ayah-source";
import { getAyahBytes } from "./audio-store";
import {
  createAyahScheduler,
  type AyahScheduler,
  type AudioContextLike,
} from "./ayah-scheduler";

export interface UseAyahPlayerOptions {
  reciterId: number;
  surah: number;
  ayahCount: number;
  onAyah?: (index: number) => void;
  AudioContextClass?: new () => AudioContextLike;
  fetchBytes?: (url: string) => Promise<ArrayBuffer>;
}

export function useAyahPlayer({
  reciterId,
  surah,
  ayahCount,
  onAyah,
  AudioContextClass,
  fetchBytes = getAyahBytes,
}: UseAyahPlayerOptions) {
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [repeat, setRepeatState] = useState(false);

  const schedulerRef = useRef<AyahScheduler | null>(null);
  const ctxRef = useRef<AudioContextLike | null>(null);
  const onAyahRef = useRef(onAyah);
  onAyahRef.current = onAyah;

  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  const reciter = selectAyahReciter(reciterId);

  const getOrCreateCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Factory =
        AudioContextClass ??
        ((window as unknown as { AudioContext: new () => AudioContextLike }).AudioContext ||
          (window as unknown as { webkitAudioContext: new () => AudioContextLike })
            .webkitAudioContext);
      if (!Factory) {
        throw new Error("AudioContext is not supported in this environment");
      }
      ctxRef.current = new Factory();
    }
    return ctxRef.current;
  }, [AudioContextClass]);

  const getOrCreateScheduler = useCallback(() => {
    if (schedulerRef.current) return schedulerRef.current;
    const ctx = getOrCreateCtx();
    const ayat = Array.from({ length: ayahCount }, (_, i) => ({
      surah,
      ayah: i + 1,
    }));

    const getDecoded = async (ref: { surah: number; ayah: number }) => {
      const url = ayahUrl(reciter, ref.surah, ref.ayah, ayahCount);
      const bytes = await fetchBytes(url);
      const audioCtx = ctx as unknown as AudioContext;
      return await audioCtx.decodeAudioData(bytes.slice(0));
    };

    const s = createAyahScheduler({
      ctx,
      getDecoded,
      ayat,
      onAyahChange: (idx) => {
        setIndex(idx);
        onAyahRef.current?.(idx);
      },
      onPlayingChange: (p) => setPlaying(p),
      onDone: () => {
        setPlaying(false);
        setIndex(0);
      },
    });
    s.setRepeat(repeatRef.current);
    schedulerRef.current = s;
    return s;
  }, [ayahCount, surah, reciter, fetchBytes, getOrCreateCtx]);

  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.destroy();
      schedulerRef.current = null;
    }
    setPlaying(false);
    setIndex(0);
  }, [reciterId, surah, ayahCount]);

  useEffect(() => {
    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.destroy();
        schedulerRef.current = null;
      }
    };
  }, []);

  const play = useCallback(async () => {
    const s = getOrCreateScheduler();
    await s.play();
  }, [getOrCreateScheduler]);

  const pause = useCallback(async () => {
    if (schedulerRef.current) {
      await schedulerRef.current.pause();
    }
  }, []);

  const toggle = useCallback(async () => {
    const s = getOrCreateScheduler();
    await s.toggle();
  }, [getOrCreateScheduler]);

  const next = useCallback(async () => {
    const s = getOrCreateScheduler();
    await s.step(1);
  }, [getOrCreateScheduler]);

  const prev = useCallback(async () => {
    const s = getOrCreateScheduler();
    await s.step(-1);
  }, [getOrCreateScheduler]);

  const seekAyah = useCallback(
    async (ayahNum1Based: number) => {
      const s = getOrCreateScheduler();
      await s.seekIndex(ayahNum1Based - 1);
    },
    [getOrCreateScheduler]
  );

  const setRepeat = useCallback((on: boolean) => {
    setRepeatState(on);
    repeatRef.current = on;
    if (schedulerRef.current) {
      schedulerRef.current.setRepeat(on);
    }
  }, []);

  return {
    playing,
    index,
    repeat,
    play,
    pause,
    toggle,
    next,
    prev,
    seekAyah,
    setRepeat,
  };
}
