import { useEffect, useState } from "react";
import "./styles/fonts.css";
import quran from "./data/quran-warsh.json";
import meta from "./data/meta.json";
import { AyahList } from "./components/AyahList";
import { PlayerBar } from "./components/PlayerBar";
import { SurahPicker } from "./components/SurahPicker";
import { useSession } from "./state/session";
import type { QuranData, Reciter, SurahTimings } from "./types";

// Les 114 fichiers de timings doivent etre decouverts a la compilation. Un
// `import()` dont le chemin est construit dynamiquement n'est pas analysable par
// Vite : en production il echoue silencieusement ou leve une erreur de resolution.
// `import.meta.glob` genere les 114Chunk(s) a la compilation.
const timingModules = import.meta.glob<{ default: SurahTimings }>(
  "./data/timings/*/*.json",
);

export function App() {
  const data = quran as unknown as QuranData;
  const metaData = meta as unknown as { reciters: Reciter[] };
  const { state, setSurah, setAyah, setReciter } = useSession();
  const surah = data.surahs[state.surah - 1];
  const [timings, setTimings] = useState<SurahTimings | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = timingModules[`./data/timings/${state.reciter}/${state.surah}.json`];
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
  }, [state.surah, state.reciter]);

  return (
    <>
      <header>
        <h1>Coran — Warsh</h1>
        <SurahPicker surahs={data.surahs} value={state.surah} onChange={setSurah} />
      </header>
      <main>
        <h2 dir="rtl" lang="ar">
          {surah.ar}
        </h2>
        <AyahList surah={surah} activeAyah={state.ayah} onSelect={setAyah} />
      </main>
      <PlayerBar
        timings={timings}
        audioUrl={timings?.audioUrl ?? ""}
        reciters={metaData.reciters}
        reciter={state.reciter}
        onReciter={setReciter}
        // `onAyah` emet `null` quand aucun ayah n'est actif ; `setAyah` attend un
        // nombre, on ne doit donc pas le transmettre tel quel.
        onAyah={(a) => {
          if (a !== null) setAyah(a);
        }}
      />
    </>
  );
}
