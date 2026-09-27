export const EXTENDED_RANGE = Object.freeze({ start: 0x870, end: 0x8ff });

export const KNOWN_KFGQPC_CODEPOINTS = Object.freeze([
  0x870, 0x872, 0x873, 0x874, 0x876, 0x878, 0x879, 0x887, 0x888, 0x8c9, 0x8cc, 0x8f0, 0x8f1, 0x8f2,
]);

const KNOWN = new Set(KNOWN_KFGQPC_CODEPOINTS);

export function findUnknownExtendedCodepoints(text) {
  const unknown = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= EXTENDED_RANGE.start && cp <= EXTENDED_RANGE.end && !KNOWN.has(cp)) {
      unknown.add(cp);
    }
  }
  return [...unknown]
    .sort((a, b) => a - b)
    .map((c) => `U+${c.toString(16).toUpperCase().padStart(4, "0")}`);
}

export const AYAH_END_MARKER = "\u06DD";

// Le suffixe est inseparable : NBSP eventuel + marqueur + numero en chiffres
// arabes-indiques. On ne retire ni le marqueur seul, ni les chiffres seuls.
const AYAH_END_SUFFIX = /\u00A0?\u06DD[\u0660-\u0669]+/g;

export function stripAyahEndMarker(text) {
  return text.replace(AYAH_END_SUFFIX, "").replaceAll("\u00A0", " ").trim();
}
