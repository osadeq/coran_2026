import { useState } from "react";

export interface SessionState {
  surah: number;
  ayah: number | null;
  reciter: number;
  playing: boolean;
}

export function useSession(initial: Partial<SessionState> = {}) {
  const [state, setState] = useState<SessionState>({
    surah: 1,
    ayah: null,
    reciter: 120,
    playing: false,
    ...initial,
  });
  return {
    state,
    setSurah: (surah: number) => setState((s) => ({ ...s, surah, ayah: null })),
    setAyah: (ayah: number | null) => setState((s) => ({ ...s, ayah })),
    setReciter: (reciter: number) => setState((s) => ({ ...s, reciter })),
    setPlaying: (playing: boolean) => setState((s) => ({ ...s, playing })),
  };
}
