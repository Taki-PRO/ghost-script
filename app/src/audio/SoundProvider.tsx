// React side of the night sounds: one lazily created engine, the two saved settings,
// and a hook that is a silent no-op outside a provider. The only audio file that imports React.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getAmbienceOn, getSoundOn, setAmbienceOn as saveAmbienceOn, setSoundOn as saveSoundOn } from '../storage/storage';
import { createSoundEngine, isWebAudioAvailable, type SoundEngine } from './engine';
import type { SoundId } from './voices';

export interface SoundApi {
  /** Web Audio exists in this browser. */
  available: boolean;
  soundOn: boolean;
  ambienceOn: boolean;
  /** Only so the Ambience_Toggle can show its disabled state. */
  reducedMotion: boolean;
  /** Stable identity; never throws and never awaits. */
  play(id: SoundId): void;
  /** Saves, then updates the engine; turning on also plays one confirming key-tap. */
  setSoundOn(on: boolean): void;
  setAmbienceOn(on: boolean): void;
  /** Called by the screens: true on the menu and the Graveyard. */
  setAmbientScreen(on: boolean): void;
}

const noop = (): void => undefined;

const NO_SOUND: SoundApi = {
  available: false,
  soundOn: false,
  ambienceOn: false,
  reducedMotion: false,
  play: noop,
  setSoundOn: noop,
  setAmbienceOn: noop,
  setAmbientScreen: noop,
};

export const SoundApiContext = createContext<SoundApi>(NO_SOUND);

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function readReduced(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia(REDUCED_QUERY).matches === true;
  } catch {
    return false;
  }
}

/** Saving may fail; the React state stays the source of truth for the page session. */
function attempt(fn: () => void): void {
  try {
    fn();
  } catch {
    /* ignore */
  }
}

export function SoundProvider({
  children,
  createEngine,
}: {
  children: ReactNode;
  createEngine?: () => SoundEngine;
}): JSX.Element {
  const [available] = useState(isWebAudioAvailable);
  const [soundOn, setSound] = useState(getSoundOn);
  const [ambienceOn, setAmbience] = useState(getAmbienceOn);
  const [ambientScreen, setAmbientScreen] = useState(false);
  const [reducedMotion, setReduced] = useState(readReduced);
  const engineRef = useRef<SoundEngine | undefined>(undefined);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // Create the engine here and dispose it in the cleanup (safe under StrictMode).
  useEffect(() => {
    if (!available) return undefined;
    let engine: SoundEngine | undefined;
    try {
      engine = (createEngine ?? createSoundEngine)();
    } catch {
      engine = undefined;
    }
    engineRef.current = engine;
    if (engine && !soundRef.current) engine.setEnabled(false);
    return () => {
      if (engineRef.current === engine) engineRef.current = undefined;
      attempt(() => engine?.dispose());
    };
    // The engine is built once per mount; createEngine is a test hook.
  }, [available]);

  useEffect(() => {
    attempt(() => engineRef.current?.setAmbience(ambienceOn && ambientScreen));
  }, [ambienceOn, ambientScreen, available]);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    let mq: MediaQueryList;
    try {
      mq = matchMedia(REDUCED_QUERY);
    } catch {
      return undefined;
    }
    const onChange = () => setReduced(mq.matches === true);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener?.(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener?.(onChange);
    };
  }, []);

  const play = useCallback((id: SoundId) => {
    attempt(() => engineRef.current?.play(id));
  }, []);

  const setSoundOn = useCallback((on: boolean) => {
    setSound(on);
    attempt(() => saveSoundOn(on));
    const engine = engineRef.current;
    if (!engine) return;
    attempt(() => {
      engine.setEnabled(on);
      if (on) {
        engine.unlock();
        engine.play('key-tap');
      }
    });
  }, []);

  const setAmbienceOn = useCallback((on: boolean) => {
    setAmbience(on);
    attempt(() => saveAmbienceOn(on));
  }, []);

  const value = useMemo<SoundApi>(
    () => ({
      available,
      soundOn,
      ambienceOn,
      reducedMotion,
      play,
      setSoundOn,
      setAmbienceOn,
      setAmbientScreen,
    }),
    [available, soundOn, ambienceOn, reducedMotion, play, setSoundOn, setAmbienceOn],
  );

  return <SoundApiContext.Provider value={value}>{children}</SoundApiContext.Provider>;
}

export function useSound(): SoundApi {
  return useContext(SoundApiContext);
}
