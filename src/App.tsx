import { useEffect, useState, useMemo } from "react";
import "./styles/fonts.css";
import { AyahList } from "./components/AyahList";
import { PlayerBar } from "./components/PlayerBar";
import { DownloadPanel } from "./components/DownloadPanel";
import { SurahPicker } from "./components/SurahPicker";
import { useSession } from "./state/session";
import { useAyahPlayer } from "./audio/use-ayah-player";
import { corpusOf } from "./data/corpora";
import { rewayaReciters, selectAyahReciter } from "../scripts/lib/manifest.mjs";
import type { SurahTimings } from "./types";

const timingModules = import.meta.glob<{ default: SurahTimings }>(
  "./data/timings/*/*.json",
);

export function App() {
  const { state, setSurah, setAyah, setReciter, setRiwaya } = useSession();
  // Plan 3, T7 : le corpus et la liste des recitants suivent le mode — plus
  // d'import fige de quran-warsh.json ni de meta.ayahReciters.
  const data = corpusOf(state.riwaya);
  const reciters = rewayaReciters(state.riwaya);
  const surah = data.surahs[state.surah - 1];
  const [timings, setTimings] = useState<SurahTimings | null>(null);

  useEffect(() => {
    // Les timings dans src/data/timings sont la table du seul Warsh : en Hafs
    // ils dementiraient (sourate 2 : 285 vs 286) — on les vide plutot que de
    // les laisser afficher une progression fausse.
    if (state.riwaya !== "warsh") {
      setTimings(null);
      return;
    }
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
  }, [state.surah, state.riwaya]);

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
          <h1 className="app-title">Coran — {state.riwaya === "warsh" ? "Warsh" : "Hafs"}</h1>
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
          reciters={reciters}
          reciter={state.reciter}
          onReciter={setReciter}
          riwaya={state.riwaya}
          onRiwaya={setRiwaya}
          playing={player.playing}
          currentIndex={player.index}
          totalAyat={surah.a.length}
          repeat={player.repeat}
          onPlay={() => void player.play()}
          onPause={() => void player.pause()}
          onPrev={() => void player.prev()}
          onNext={() => void player.next()}
          onSeek={handleSelectAyah}
          onToggleRepeat={() => player.setRepeat(!player.repeat)}
          timings={timings}
        />
      </header>
      {/* Attribut attendu par la T8 (police par mode) et deja assertable ici. */}
      <main className="app-main" data-riwaya={state.riwaya}>
        <h2 dir="rtl" lang="ar" className="surah-heading">
          {surah.ar}
        </h2>
        <AyahList surah={surah} activeAyah={state.ayah} onSelect={handleSelectAyah} />
      </main>
    </>
  );
}
