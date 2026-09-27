export function estimateTail({ durationMs, coveredMax, canonicalCount, wordsOf }) {
  const count = canonicalCount - coveredMax;
  if (count <= 0) return [];

  const weights = [];
  for (let i = 0; i < count; i += 1) {
    weights.push(Math.max(1, wordsOf(coveredMax + i + 1)));
  }
  const total = weights.reduce((a, b) => a + b, 0);

  const rows = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    // Math.max(1, ...) garantit une duree strictement positive meme quand un seul ayah
    // domine le ponderal ; Math.min(durationMs - 1, ...) empeche de depasser la fin.
    const end =
      i === count - 1
        ? durationMs
        : Math.min(
            durationMs - 1,
            cursor + Math.max(1, Math.round((weights[i] / total) * durationMs)),
          );
    rows.push([coveredMax + i + 1, cursor, end]);
    cursor = end;
  }
  return rows;
}
