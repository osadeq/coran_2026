export function compareWithQuranMeta(rows, warsh) {
  const pageDiffs = [];
  const juzDiffs = [];
  for (const r of rows) {
    const key = `${r.sura_no}:${r.aya_no}`;
    const page = warsh.findPage(r.sura_no, r.aya_no);
    if (page !== r.page) pageDiffs.push({ ayah: key, kfc: r.page, meta: page });
    const juz = warsh.findJuz(r.sura_no, r.aya_no);
    if (juz !== r.jozz) juzDiffs.push({ ayah: key, kfc: r.jozz, meta: juz });
  }
  return { pageDiffs, juzDiffs };
}

export function formatJuzDiffs(diffs) {
  return diffs
    .map((d) => `${d.ayah}  KFC=${d.kfc}  meta=${d.meta}`)
    .sort()
    .join("\n");
}
