// Plan 2, T-D — le hook est le SEUL endroit ou vit un AudioContext.
//
// Il ne pilote pas un <audio> : depuis T-A la source est « un mp3 par verset », donc
// il n'existe pas de flux continu sur lequel lire un `currentTime`. C'est
// l'ordonnanceur a relais de T-C qui tient l'horloge : une source Web Audio par
// verset, enchainee sans blanc, et c'est son `onAyahChange` qui fait avancer la
// surbrillance. Ce hook se contente de construire l'ordonnanceur, de le detruire
// quand la sourate ou le recitant change, et d'adapter son API publique (1-based
// comme le reste de l'application) a celle du scheduler (0-based).
//
// `timings` n'est plus lu : ces decoupages sont des offsets absolus de la sourate
// ENTIERE, sans rapport avec la duree d'un verset isole. Le champ reste declare
// parce que App.tsx le transmet ; PlayerBar s'en sert, lui, pour la progression.
import { useCallback, useEffect, useRef, useState } from "react";
import { selectAyahReciter } from "../../scripts/lib/manifest.mjs";
import { ayahUrl } from "./ayah-source";
import { getAyahBytes } from "./audio-store";
import {
  createAyahScheduler,
  type AyahRef,
  type AyahScheduler,
  type AudioBufferLike,
  type AudioContextLike,
  type BufferSourceLike,
} from "./ayah-scheduler";
import type { Riwaya, SurahTimings } from "../types";

export interface UseAyahPlayerOptions {
  reciterId: number;
  surah: number;
  ayahCount: number;
  /**
   * Obligatoire (plan 3, T6) : 64 sourates ont le meme nombre de versets dans
   * les deux corpus, donc sans elle dans la cle de redemarrage un changement de
   * mode passerait pour « meme lecture » et la position serait conservee.
   */
  riwaya: Riwaya;
  /** Conserve pour compatibilite avec App.tsx ; la lecture ne s'en sert pas. */
  timings?: SurahTimings | null;
  onAyah?: (index: number) => unknown;
  /** Injecte dans les tests ; en production, `globalThis.AudioContext`. */
  AudioContextClass?: unknown;
  /** Injecte dans les tests ; en production, le magasin Cache Storage. */
  fetchBytes?: (url: string) => Promise<ArrayBuffer>;
}

/** Verset muet d'un court delai : permet de sauter un mp3 indisponible. */
const SILENT_SKIPPED = 0.05;

/**
 * Le contrat `AudioContextLike` du scheduler est volontairement etroit (c'est ce qui
 * le rend testable hors navigateur), mais sur un seul point il ne recouvre pas le DOM :
 * `AudioBufferSourceNode.onended` recoit un `Event`. Plutot que d'elargir le contrat
 * teste de T-C, on adapte ici le contexte reel vers le contrat attendu.
 */
function adaptContext(native: AudioContext): AudioContextLike {
  return {
    get currentTime() {
      return native.currentTime;
    },
    get destination() {
      return native.destination;
    },
    createBufferSource(): BufferSourceLike {
      const src = native.createBufferSource();
      return {
        // Le scheduler n'ecrit que des AudioBuffer reels : seul le type est elargi.
        get buffer(): AudioBufferLike | null {
          return src.buffer as unknown as AudioBufferLike | null;
        },
        set buffer(buf: AudioBufferLike | null) {
          src.buffer = buf as unknown as AudioBuffer;
        },
        connect(dest: unknown) {
          src.connect(dest as AudioNode);
        },
        disconnect(): void {
          src.disconnect();
        },
        start(when?: number) {
          src.start(when);
        },
        stop(when?: number) {
          src.stop(when);
        },
        // Le DOM fournit un evenement que le scheduler ignore : on ne lui expose
        // qu'un rappel sans argument, et on masque la lecture de la source.
        set onended(handler: (() => void) | null) {
          src.onended = handler ? () => handler() : null;
        },
        get onended(): (() => void) | null {
          return null;
        },
      };
    },
    resume: () => native.resume(),
    suspend: () => native.suspend(),
  };
}

export function useAyahPlayer({
  reciterId,
  surah,
  ayahCount,
  riwaya,
  onAyah,
  AudioContextClass,
  fetchBytes,
}: UseAyahPlayerOptions) {
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [repeat, setRepeatState] = useState(false);

  const schedulerRef = useRef<AyahScheduler | null>(null);
  const ctxRef = useRef<{ close?: () => Promise<unknown> } | null>(null);
  const indexRef = useRef(0);
  // App.tsx passe une fleche inline : sans ref, chaque rendu construirait un
  // ordonnanceur neuf et couperait la lecture en cours.
  const onAyahRef = useRef(onAyah);
  onAyahRef.current = onAyah;
  // Un repeat pose avant le premier play() doit survivre a la construction de
  // l'ordonnanceur, qui repart d'un etat neuf.
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  // Miroir de `playing` : l'effet de reinitialisation doit savoir si la lecture
  // tournait SANS avoir `playing` dans ses dependances (le lire dans l'etat
  // re-executerait l'effet a chaque play/pause).
  const playingRef = useRef(false);
  const setPlayingBoth = useCallback((on: boolean) => {
    playingRef.current = on;
    setPlaying(on);
  }, []);
  // Derniere configuration connue, pour distinguer « seul le recitant a change »
  // (on peut reprendre la lecture) de « la lecture a change » (il faut repartir).
  const lastKeyRef = useRef({ reciterId, surah, ayahCount, riwaya });

  const announce = useCallback((i: number) => {
    indexRef.current = i;
    setIndex(i);
    onAyahRef.current?.(i);
  }, []);

  const ensureScheduler = useCallback((): AyahScheduler => {
    const existant = schedulerRef.current;
    if (existant) return existant;

    const Ctor =
      AudioContextClass ??
      (globalThis as { AudioContext?: unknown }).AudioContext ??
      (globalThis as { webkitAudioContext?: unknown }).webkitAudioContext;
    if (typeof Ctor !== "function") {
      throw new Error("Web Audio indisponible dans cet environnement.");
    }
    const nativeCtx = new (Ctor as new () => AudioContext)();
    ctxRef.current = nativeCtx;

    const reciter = selectAyahReciter(reciterId);
    const ayat: AyahRef[] = Array.from({ length: ayahCount }, (_, i) => ({
      surah,
      ayah: i + 1,
    }));
    const readBytes = fetchBytes ?? getAyahBytes;

    const scheduler = createAyahScheduler({
      ctx: adaptContext(nativeCtx),
      getDecoded: async (ref) => {
        try {
          const bytes = await readBytes(ayahUrl(reciter, ref.surah, ref.ayah, ayahCount));
          return await nativeCtx.decodeAudioData(bytes);
        } catch (err) {
          // Un verset indisponible ne doit pas tuer la chaine : on le saute plutot
          // que de laisser l'ordonnanceur s'arreter sur une promesse rejetee.
          console.warn(`audio indisponible (sourate ${ref.surah}, verset ${ref.ayah})`, err);
          return { duration: SILENT_SKIPPED };
        }
      },
      ayat,
      onAyahChange: announce,
      onPlayingChange: setPlayingBoth,
      // Fin naturelle : le scheduler reboucle sur l'index 0 mais ne passe pas par
      // onAyahChange. Sans ceci, la surbrillance resterait bloquee sur le dernier
      // verset alors que la lecture s'est arretee.
      onDone: () => announce(0),
    });
    scheduler.setRepeat(repeatRef.current);
    schedulerRef.current = scheduler;
    return scheduler;
  }, [reciterId, surah, ayahCount, riwaya, AudioContextClass, fetchBytes, announce, setPlayingBoth]);

  // Changer de sourate, de nombre de versets ou de recitant invalide l'ordonnanceur
  // et son contexte : ils sont fermes et reconstruits au prochain besoin.
  //
  // Ce qui se relance ensuite depend du geste, parce que les deux ne se valent pas.
  //
  // Changer de SOURATE, c'est l'utilisateur qui dit « je veux ecouter celle-la » : la
  // lecture repart toujours, depuis le verset 1, meme si elle etait arretee ou jamais
  // demarree. C'est ce qui donne au select l'impression que le choix « prend ».
  //
  // Changer de RECITANT, en revanche, ne touche pas au texte lu : c'est la meme sourate
  // au meme verset, simplement une autre voix. La position est conservee, et la lecture
  // ne repart que si elle tournait deja — changer de voix en pause ne doit pas passer
  // pour un ordre de jouer.
  useEffect(() => {
    const previous = lastKeyRef.current;
    lastKeyRef.current = { reciterId, surah, ayahCount, riwaya };

    // Plan 3, T6 : la riwaya appartient a la cle. 64 sourates sur 114 ont le meme
    // nombre de versets dans les deux corpus — sans la comparaison ci-dessous, une
    // bascule de mode passerait pour « meme lecture » et conserverait la position
    // au lieu de repartir au verset 1. Comparaison en ligne, pas de constante
    // partagee : la comparaison elle-meme est la documentation.
    const memeLecture =
      previous.surah === surah &&
      previous.ayahCount === ayahCount &&
      previous.riwaya === riwaya;
    const position = memeLecture ? indexRef.current : 0;
    // Au montage `memeLecture` est vrai et rien n'a demarre : la page se charge en
    // silence. C'est aussi ce qui empeche un autoplay refuse par le navigateur.
    const relancer = !memeLecture || playingRef.current;

    schedulerRef.current?.destroy();
    schedulerRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    void ctx?.close?.().catch(() => {
      // un contexte deja ferme n'est pas une erreur : rien a signaler.
    });

    indexRef.current = position;
    setIndex(position);
    setPlayingBoth(false);

    if (!relancer) return;

    // Le contexte neuf nait dans un effet, donc hors du geste utilisateur : Chrome le
    // demarre suspendu. `play()` appelle `ctx.resume()`, qui reussit car le geste
    // declencheur — le clic sur Lecture, ou la selection d'une sourate — a active la
    // page (activation « sticky »).
    void (async () => {
      try {
        const scheduler = ensureScheduler();
        await scheduler.seekIndex(position);
        await scheduler.play();
      } catch (err) {
        console.error("reprise impossible apres changement de sourate ou de recitant", err);
        setPlayingBoth(false);
      }
    })();
  }, [reciterId, surah, ayahCount, riwaya, ensureScheduler, setPlayingBoth]);

  const play = useCallback(async () => {
    try {
      await ensureScheduler().play();
    } catch (err) {
      console.error("lecture impossible", err);
      setPlayingBoth(false);
    }
  }, [ensureScheduler, setPlayingBoth]);

  const pause = useCallback(async () => {
    await schedulerRef.current?.pause();
  }, []);

  const toggle = useCallback(async () => {
    if (schedulerRef.current?.playing) await pause();
    else await play();
  }, [pause, play]);

  const seekAyah = useCallback(
    async (ayahNum1Based: number) => {
      const target = Math.max(0, Math.min(ayahCount - 1, ayahNum1Based - 1));
      const scheduler = schedulerRef.current;
      if (!scheduler) {
        // Aucun geste de lecture encore : pas d'AudioContext a creer hors interaction,
        // mais la position et la surbrillance doivent suivre le clic.
        announce(target);
        return;
      }
      await scheduler.seekIndex(target);
    },
    [ayahCount, announce],
  );

  const step = useCallback(
    async (delta: number) => {
      const scheduler = schedulerRef.current;
      if (!scheduler) {
        const target = Math.max(0, Math.min(ayahCount - 1, indexRef.current + delta));
        announce(target);
        return;
      }
      await scheduler.step(delta);
    },
    [ayahCount, announce],
  );

  const next = useCallback(async () => {
    await step(1);
  }, [step]);

  const prev = useCallback(async () => {
    await step(-1);
  }, [step]);

  const setRepeat = useCallback((on: boolean) => {
    setRepeatState(on);
    schedulerRef.current?.setRepeat(on);
  }, []);

  return {
    playing,
    index,
    repeat,
    play,
    pause,
    toggle,
    next,
    prev,
    seekAyah,
    setRepeat,
  };
}