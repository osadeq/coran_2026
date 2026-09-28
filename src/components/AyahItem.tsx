import type { AyahRow } from "../types";

interface Props {
  ayah: number;
  text: string;
  juz: number;
  page: number;
  active: boolean;
  onSelect: (ayah: number) => void;
}

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export function AyahItem({ ayah, text, juz, page, active, onSelect }: Props) {
  return (
    <li
      className="ayah"
      data-active={active}
      data-testid={`ayah-${ayah}`}
      onClick={() => onSelect(ayah)}
    >
      <span className="ayah-marker" aria-hidden="true">
        {toArabicDigits(ayah)}
      </span>
      <span className="ayah-text" lang="ar" dir="rtl" data-testid={`ayah-${ayah}-text`}>
        {text}
      </span>
      <span className="ayah-ref">
        {juz}:{page}
      </span>
    </li>
  );
}

export type { AyahRow };
