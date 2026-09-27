import type { TimingRow } from "../types";

/**
 * Renvoie le numero d'ayah courant, ou null avant le premier ayah.
 * Un trou entre deux ayahs conserve l'ayah courant plutot que de perdre le surlignage.
 */
export function findAyahAt(rows: readonly TimingRow[], ms: number): number | null {
  if (rows.length === 0) return null;
  if (ms < rows[0][1]) return null;

  let lo = 0;
  let hi = rows.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][1] <= ms) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return rows[best][0];
}
