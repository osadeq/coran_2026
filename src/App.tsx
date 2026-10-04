import { useEffect, useState, useMemo } from "react";
import "./styles/fonts.css";
import quran from "./data/quran-warsh.json";
import meta from "./data/meta.json";
import { AyahList } from "./components/AyahList";
import { PlayerBar } from "./components/PlayerBar";
import { DownloadPanel } from "./components/DownloadPanel";
import { SurahPicker } from "./components/SurahPicker";
import { useSession } from "./state/session";
import { useAyahPlayer } from "./audio/use-ayah-player";
import { selectAyahReciter } from "../scripts/lib/manifest.mjs";
import type { AyahReciter, QuranData, SurahTimings } from "./types";

const timingModules = import.meta.glob<{ default: SurahTimings }>(
  "./data/timings/*/*.json",
);

export function App() {
  const data = quran as unknown as QuranData;
  const metaData = meta as unknown as { ayahReciters: AyahReciter[] };
  const ayahReciters = metaData.ayahReciters ?? [];
  const { state, setSurah, setAyah, setReciter } = useSession();
  const surah = data.surahs[state.surah - 1];
  const [timings, setTimings] = useState<SurahTimings | null>(null);

  const player = useAyahPlayer({
    reciterId: state.reciter,
    surah: state.surah,
    ayahCount: surah.a.length,
    onAyah: (idx) => setAyah(idx + 1),
  });

  useEffect(() => {
    let cancelled = false;
    const load = timingModules[`./data/timings/120/${state.surah}.json`];
    if (!load) {
      setTimings(null);
      return;
    }
    void load().then((mod) => {
      if (!cancelled) setTimings(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [state.surah]);

  const activeReciter = useMemo(() => {
    return selectAyahReciter(state.reciter);
  }, [state.reciter]);

  const currentAyahIndex = state.ayah ? state.ayah - 1 : player.index;

  const handleSelectAyah = (ayahNum: number) => {
    setAyah(ayahNum);
    void player.seekAyah(ayahNum);
  };

  return (
    <>
      <header>
        <h1>Coran — Warsh</h1>
        <SurahPicker surahs={data.surahs} value={state.surah} onChange={setSurah} />
      </header>
      <main>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 dir="rtl" lang="ar">
            {surah.ar}
          </h2>
          <DownloadPanel
            surah={surah}
            ayahIndex={currentAyahIndex}
            reciter={activeReciter}
            quran={data}
          />
        </div>
        <AyahList surah={surah} activeAyah={state.ayah} onSelect={handleSelectAyah} />
      </main>
      <PlayerBar
        reciters={ayahReciters}
        reciter={state.reciter}
        onReciter={setReciter}
        playing={player.playing}
        currentIndex={player.index}
        totalAyat={surah.a.length}
        repeat={player.repeat}
        onPlay={() => void player.play()}
        onPause={() => void player.pause()}
        onPrev={() => void player.prev()}
        onNext={() => void player.next()}
        onToggleRepeat={() => player.setRepeat(!player.repeat)}
        timings={timings}
      />
    </>
  );
}
