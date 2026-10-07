import { useEffect, useRef } from "react";
import type { AyahRow } from "../types";

interface Props {
  ayah: number;
  text: string;
  juz: number;
  page: number;
  active: boolean;
  follow?: boolean;
  onSelect: (ayah: number) => void;
}

const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export function AyahItem({
  ayah,
  text,
  juz,
  page,
  active,
  follow = true,
  onSelect,
}: Props) {
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (active && follow && ref.current) {
      ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [active, follow]);

  return (
    <li
      ref={ref}
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
