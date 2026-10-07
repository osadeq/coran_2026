// Plan 2, T-C — ordonnanceur « a relais » : l'algo des deux agents qui se relayent,
// traduit en une seule ligne de temps Web Audio.
//
// Principe du gap 0 : un unique AudioContext possede l'horloge ; `playhead` porte le
// temps ctx OU le verset courant se termine. La piste suivante est ordonnancee
// `src.start(playhead)` quand la precedente se termine, avec un buffer DEJA decode
// (prefetch profondeur 1) : le creneau s'enchaîne sur le precedent, le blanc est nul
// a l'echantillon pres.
// Pause/reprise = ctx.suspend()/resume() : l'horloge entiere gele, la piste en vol
// ET les creneaux suivants suivent sans calcul d'offset par nceud — la reprise ne
// re-ordonnance rien, elle dégele.
//
// Purete testable : le ctx et getDecoded sont injectes (voir tests/unit/ayah-scheduler.test.ts).
// Les buffers pre-decodes forment une fenetre de profondeur `prefetchDepth` (defaut 1,
// ~18 Mo en pic) ; la memoire du verset joue est evincee a chaque relais.

export interface AudioBufferLike {
  readonly duration: number;
}

export interface BufferSourceLike {
  buffer: AudioBufferLike | null;
  connect(dest: unknown): void;
  disconnect(): void;
  start(when?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  createBufferSource(): BufferSourceLike;
  suspend(): Promise<void>;
  resume(): Promise<void>;
}

/** Un verset adressable (index dans la liste = position de lecture). */
export interface AyahRef {
  surah: number;
  ayah: number;
}

export interface AyahSchedulerOptions {
  ctx: AudioContextLike;
  getDecoded: (ref: AyahRef) => Promise<AudioBufferLike>;
  ayat: AyahRef[];
  prefetchDepth?: number;
  onAyahChange?: (index: number) => void;
  onDone?: () => void;
  onPlayingChange?: (playing: boolean) => void;
}

export interface AyahScheduler {
  play(): Promise<void>;
  pause(): Promise<void>;
  toggle(): Promise<void>;
  seekIndex(i: number): Promise<void>;
  step(delta: number): Promise<void>;
  setRepeat(on: boolean): void;
  getRepeating(): boolean;
  readonly index: number;
  readonly playing: boolean;
  destroy(): void;
}

export function createAyahScheduler(opts: AyahSchedulerOptions): AyahScheduler {
  const { ctx, getDecoded, ayat, onAyahChange, onDone, onPlayingChange } = opts;
  const depth = Math.max(1, opts.prefetchDepth ?? 1);

  let index = 0;
  let playhead = 0;
  let playing = false;
  // L'horloge est-elle gelee par une pause ? Si oui, play() dégele sans rien
  // re-ordonnancer (la piste en vol et son creneau redeviennent simplement reels).
  let clockSuspended = false;
  let repeat = false;
  // Chaque seek/destroy incremente `token` : les callbacks onended et les awaits en
  // vol d'une generation obsolete deviennent des no-op (garde dans scheduleFrom).
  let token = 0;
  let currentSource: BufferSourceLike | null = null;
  const memo = new Map<number, Promise<AudioBufferLike>>();

  function memoAt(i: number): Promise<AudioBufferLike> | null {
    if (i < 0 || i >= ayat.length) return null;
    const hit = memo.get(i);
    if (hit) return hit;
    const p = getDecoded(ayat[i]);
    memo.set(i, p);
    return p;
  }

  function stopCurrent(): void {
    if (!currentSource) return;
    const src = currentSource;
    currentSource = null;
    try {
      src.stop();
    } catch {
      // deja termine : stop sur une piste finie peut lever, ce n'est pas grave.
    }
    src.onended = null;
    src.disconnect();
  }

  async function scheduleFrom(i: number, myToken: number): Promise<void> {
    if (myToken !== token || !playing) return;
    if (i >= ayat.length) {
      playing = false;
      index = 0; // rejeu depuis le debut si on relance apres une fin naturelle
      onPlayingChange?.(false);
      onDone?.();
      return;
    }
    if (i > 0) memo.delete(i - 1); // eviction de la fenetre : le joue est libere
    const buf = await memoAt(i);
    // Garde triple : generation obsolete, pause-annee, ou await qui a traine.
    if (buf === null || myToken !== token || !playing) return;
    index = i;
    onAyahChange?.(i);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(playhead);
    playhead = playhead + buf.duration;
    currentSource = src;
    void memoAt(i + depth); // cartouche suivante pre-decodee pendant que celle-ci joue
    src.onended = () => {
      // Un onended tardif (piste stoppee par seek, scheduler detruit, piste
      // remplacee) ne relance rien. En repeat, la meme position rejoue a creneau
      // enchaîne (gap 0 meme dans la repetition).
      if (myToken !== token || !playing || src !== currentSource) return;
      void scheduleFrom(repeat ? i : i + 1, myToken);
    };
  }

  const scheduler: AyahScheduler = {
    async play() {
      if (playing) return;
      playing = true;
      onPlayingChange?.(true);
      const myToken = token;
      await ctx.resume();
      if (myToken !== token || !playing) return; // seek/destroy pendant l'attente
      if (clockSuspended) {
        // Reprise d'une pause : rien a ordonnancer, la piste en vol dégele et son
        // onended poursuivra la chaine.
        clockSuspended = false;
        return;
      }
      playhead = ctx.currentTime;
      await scheduleFrom(index, myToken);
    },
    async pause() {
      if (!playing) return;
      await ctx.suspend();
      clockSuspended = true;
      playing = false;
      onPlayingChange?.(false);
    },
    async toggle() {
      if (playing) await scheduler.pause();
      else await scheduler.play();
    },
    async seekIndex(i) {
      const target = Math.min(Math.max(0, i), ayat.length - 1);
      if (playing) {
        const myToken = ++token;
        await ctx.suspend();
        stopCurrent();
        index = target;
        playhead = ctx.currentTime;
        await scheduleFrom(target, myToken);
        await ctx.resume();
        clockSuspended = false;
      } else {
        // En pause : on repositionne et on signale le verset cible, sans rien
        // ordonnancer. La piste gelee est stoppee : la reprise ne doit plus
        // simplement degeler l'horloge, elle doit ordonnancer la cible.
        stopCurrent();
        clockSuspended = false;
        index = target;
        onAyahChange?.(target);
      }
    },
    async step(delta) {
      await scheduler.seekIndex(index + delta);
    },
    setRepeat(on) {
      repeat = on;
    },
    getRepeating() {
      return repeat;
    },
    get index() {
      return index;
    },
    get playing() {
      return playing;
    },
    destroy() {
      token += 1;
      playing = false;
      clockSuspended = false;
      stopCurrent();
      memo.clear();
    },
  };
  return scheduler;
}
