interface Props {
  surahs: { n: number; en: string; ar: string }[];
  value: number;
  onChange: (surah: number) => void;
}

export function SurahPicker({ surahs, value, onChange }: Props) {
  return (
    <select
      aria-label="Sourate"
      value={value}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
    >
      {surahs.map((s) => (
        <option key={s.n} value={s.n}>
          {s.n}. {s.en}
        </option>
      ))}
    </select>
  );
}
