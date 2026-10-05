// Plan 3 (T4) — la session porte la riwaya de lecture.
//
// La revalidation du recitant n'est pas un confort : depuis la T2 les ids 1..8
// couvrent les deux modes (Warsh = 1, Hafs = 2..8). Une session persistante qui
// porte encore un ancien id (2 ou 3, jadis Warsh, aujourd'hui Hafs) selectionnerait
// une voix de l'autre riwaya. D'où le rappel a `defaultAyahReciter` a l'initialisation
// (une fois, dans l'initialiseur useState — pas un useEffect, qui laisserait un
// premier rendu avec une voix invalide) et a chaque `setRiwaya`.
import { useState } from "react";
import { defaultAyahReciter, rewayaReciters } from "../../scripts/lib/manifest.mjs";
import type { Riwaya } from "../types";

export interface SessionState {
  surah: number;
  ayah: number | null;
  reciter: number;
  riwaya: Riwaya;
}

export function useSession(initial: Partial<SessionState> = {}) {
  const [state, setState] = useState<SessionState>(() => {
    const merged: SessionState = {
      surah: 1,
      ayah: null,
      riwaya: "warsh",
      reciter: 1,
      ...initial,
    };
    // Revalidation : le recitant memorise doit appartenir au mode effectif.
    // `number[]` et non l'unite litterale inferee du manifeste : `reciter` est
    // un nombre general dans SessionState.
    const valides: number[] = rewayaReciters(merged.riwaya).map((r) => r.id);
    return valides.includes(merged.reciter)
      ? merged
      : { ...merged, reciter: defaultAyahReciter(merged.riwaya).id };
  });
  return {
    state,
    setSurah: (surah: number) => setState((s) => ({ ...s, surah, ayah: null })),
    setAyah: (ayah: number | null) => setState((s) => ({ ...s, ayah })),
    setReciter: (reciter: number) => setState((s) => ({ ...s, reciter })),
    // Un changement de riwaya change de corpus : aucun verset memorise ne peut
    // lui survivre, et la voix repart sur le defaut du nouveau mode.
    setRiwaya: (riwaya: Riwaya) =>
      setState((s) => ({
        ...s,
        riwaya,
        reciter: defaultAyahReciter(riwaya).id,
        ayah: null,
      })),
  };
}
