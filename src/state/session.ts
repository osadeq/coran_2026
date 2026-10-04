import { useState } from "react";

export interface SessionState {
  surah: number;
  ayah: number | null;
  reciter: number;
}

export function useSession(initial: Partial<SessionState> = {}) {
  const [state, setState] = useState<SessionState>({
    surah: 1,
    ayah: null,
    reciter: 1,
    ...initial,
  });
  return {
    state,
    setSurah: (surah: number) => setState((s) => ({ ...s, surah, ayah: null })),
    setAyah: (ayah: number | null) => setState((s) => ({ ...s, ayah })),
    setReciter: (reciter: number) => setState((s) => ({ ...s, reciter })),
  };
}
