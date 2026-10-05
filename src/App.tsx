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

  const player = useAyahPlayer({
    reciterId: state.reciter,
    surah: state.surah,
    ayahCount: surah.a.length,
    // Plan 3, T6 : obligatoire depuis ce commit. La session porte la riwaya
    // depuis la T4 ; le selecteur de mode (T7) en changera la valeur.
    riwaya: state.riwaya,
    timings,
    onAyah: (idx) => setAyah(idx + 1),
  });

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
      <header className="app-header">
        <div className="app-header-top">
          <h1 className="app-title">Coran — Warsh</h1>
          <div className="app-header-tools">
            <SurahPicker surahs={data.surahs} value={state.surah} onChange={setSurah} />
            <DownloadPanel
              surah={surah}
              ayahIndex={currentAyahIndex}
              reciter={activeReciter}
              quran={data}
            />
          </div>
        </div>
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
      </header>
      <main className="app-main">
        <h2 dir="rtl" lang="ar" className="surah-heading">
          {surah.ar}
        </h2>
        <AyahList surah={surah} activeAyah={state.ayah} onSelect={handleSelectAyah} />
      </main>
    </>
  );
}
