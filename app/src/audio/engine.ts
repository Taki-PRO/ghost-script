// The night-sounds engine: one lazy AudioContext, one master chain, voice limiting and the wind.
// No React, no audio files, no storage, no console. Every failure is silent.
import { AMBIENCE, DURATION_MS, LIMITER, MASTER_GAIN, RECIPES, STOP_PAD, buildVoice, fillNoise } from './recipes';
import { createLimiter, type SoundId } from './voices';

export interface SoundEngine {
  play(id: SoundId): void;
  setEnabled(on: boolean): void;
  /** `wanted` already includes the saved wind choice and the screen. */
  setAmbience(wanted: boolean): void;
  unlock(): void;
  suspend(): void;
  dispose(): void;
}

type MQ = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'> & {
  addListener?: (l: () => void) => void;
  removeListener?: (l: () => void) => void;
};

export interface EngineDeps {
  createContext?: () => AudioContext;
  now?: () => number;
  doc?: Document;
  matchMedia?: (q: string) => Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;
}

type Ctor = new () => AudioContext;
const ctor = (): Ctor | undefined => {
  const w = globalThis as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return typeof w.AudioContext === 'function'
    ? w.AudioContext
    : typeof w.webkitAudioContext === 'function'
      ? w.webkitAudioContext
      : undefined;
};

/** True when AudioContext or webkitAudioContext exists. Constructs nothing. */
export function isWebAudioAvailable(): boolean {
  return ctor() !== undefined;
}

const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
const WINDOW_MS = 300;
const QUERY = '(prefers-reduced-motion: reduce)';

export function createSoundEngine(deps: EngineDeps = {}): SoundEngine {
  const doc = deps.doc ?? document;
  const now = deps.now ?? (() => performance.now());
  const make =
    deps.createContext ??
    (() => {
      const C = ctor();
      if (!C) throw new Error('no web audio');
      return new C();
    });
  const limiter = createLimiter(now, DURATION_MS);
  const sources = new Set<AudioScheduledSourceNode>();
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  let windBuf: AudioBuffer | undefined;
  let wind: { stop(fade: boolean): void } | undefined;
  let enabled = true;
  let wanted = false;
  let gesture = false;
  let broken = false;
  let disposed = false;
  let resumeAt: number | null = null;

  const mm: MQ | undefined = (() => {
    try {
      const f = deps.matchMedia ?? (typeof matchMedia === 'function' ? (q: string) => matchMedia(q) : undefined);
      return f?.(QUERY);
    } catch {
      return undefined;
    }
  })();
  let reduced = mm?.matches === true;

  const visible = () => doc.visibilityState !== 'hidden';
  const buffer = (c: AudioContext, seconds: number, smooth: boolean): AudioBuffer => {
    const b = c.createBuffer(1, Math.round(seconds * c.sampleRate), c.sampleRate);
    fillNoise(b.getChannelData(0), smooth);
    return b;
  };

  const build = () => {
    if (ctx || broken) return;
    try {
      const c = make();
      const g = c.createGain();
      g.gain.value = MASTER_GAIN;
      const k = c.createDynamicsCompressor();
      k.threshold.value = LIMITER.threshold;
      k.knee.value = LIMITER.knee;
      k.ratio.value = LIMITER.ratio;
      k.attack.value = LIMITER.attack;
      k.release.value = LIMITER.release;
      g.connect(k);
      k.connect(c.destination);
      c.onstatechange = sync;
      ctx = c;
      master = g;
    } catch {
      broken = true;
      ctx = master = undefined;
    }
  };

  const stopAll = () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    sources.clear();
    limiter.reset();
  };

  const startWind = (c: AudioContext, dest: AudioNode) => {
    const A = AMBIENCE;
    const t = c.currentTime;
    const nodes: AudioNode[] = [];
    const srcs: AudioScheduledSourceNode[] = [];
    const lfo = (rate: number, depth: number, target: AudioParam) => {
      const o = c.createOscillator();
      const d = c.createGain();
      o.frequency.value = rate;
      d.gain.value = depth;
      o.connect(d);
      d.connect(target);
      nodes.push(o, d);
      srcs.push(o);
    };
    try {
      windBuf ??= buffer(c, A.loopSeconds, true);
      const src = c.createBufferSource();
      src.buffer = windBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = A.centre;
      f.Q.value = A.q;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(A.base, t + A.fadeIn);
      src.connect(f);
      f.connect(g);
      g.connect(dest);
      nodes.push(src, f, g);
      srcs.push(src);
      lfo(A.lfoHz, A.depth, f.frequency);
      lfo(A.lfoHz, A.lfoGain, g.gain);
      for (const s of srcs) s.start(t);
      wind = {
        stop(fade) {
          const end = () => {
            for (const n of nodes) {
              try {
                n.disconnect();
              } catch {
                /* already released */
              }
            }
          };
          try {
            if (fade) {
              const u = c.currentTime;
              g.gain.cancelScheduledValues(u);
              g.gain.setValueAtTime(g.gain.value, u);
              g.gain.linearRampToValueAtTime(0, u + A.fadeOut);
              srcs[0].onended = end;
              for (const s of srcs) s.stop(u + A.fadeOut + STOP_PAD);
            } else {
              for (const s of srcs) s.stop();
              end();
            }
          } catch {
            end();
          }
        },
      };
    } catch {
      for (const s of srcs) {
        try {
          s.stop();
        } catch {
          /* never started */
        }
      }
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          /* already released */
        }
      }
      wind = undefined;
    }
  };

  function sync() {
    const on = !disposed && enabled && wanted && gesture && !broken && ctx?.state === 'running' && visible() && !reduced;
    if (on && !wind && ctx && master) startWind(ctx, master);
    else if (!on && wind) {
      const w = wind;
      wind = undefined;
      w.stop(!disposed && enabled && ctx?.state === 'running' && visible());
    }
  }

  const resume = () => {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    const at = now();
    resumeAt = at;
    const settle = () => {
      if (resumeAt === at) resumeAt = null;
      sync();
    };
    try {
      Promise.resolve(ctx.resume()).then(settle, settle);
    } catch {
      resumeAt = null;
    }
  };

  const unlock = () => {
    if (!enabled || broken || disposed) return;
    gesture = true;
    build();
    resume();
    sync();
  };

  const suspend = () => {
    if (disposed) return;
    wind?.stop(false);
    wind = undefined;
    try {
      ctx?.suspend().catch(() => undefined);
    } catch {
      /* ignore */
    }
  };

  const onVisibility = () => {
    if (visible()) {
      if (enabled && gesture) resume();
      sync();
    } else {
      stopAll();
      sync();
      suspend();
    }
  };
  const onReduced = () => {
    reduced = mm?.matches === true;
    sync();
  };

  for (const e of GESTURES) doc.addEventListener(e, unlock, { capture: true, passive: true });
  doc.addEventListener('visibilitychange', onVisibility);
  if (mm?.addEventListener) mm.addEventListener('change', onReduced);
  else mm?.addListener?.(onReduced);

  return {
    play(id) {
      if (!enabled || !gesture || broken || disposed || !ctx || !master || !visible()) return;
      if (ctx.state === 'closed') return;
      const inWindow = resumeAt !== null && now() - resumeAt < WINDOW_MS;
      if (ctx.state !== 'running' && !inWindow) return;
      if (!limiter.accept(id).accept) return;
      try {
        noise ??= buffer(ctx, 1, false);
        buildVoice(ctx, master, RECIPES[id], noise, ctx.currentTime, sources);
      } catch {
        /* drop the voice */
      }
    },
    setEnabled(on) {
      if (disposed) return;
      enabled = on;
      if (!on) {
        stopAll();
        sync();
        suspend();
      } else if (gesture) unlock();
      else sync();
    },
    setAmbience(w) {
      wanted = w;
      sync();
    },
    unlock,
    suspend,
    dispose() {
      if (disposed) return;
      stopAll();
      wind?.stop(false);
      wind = undefined;
      disposed = true;
      for (const e of GESTURES) doc.removeEventListener(e, unlock, { capture: true });
      doc.removeEventListener('visibilitychange', onVisibility);
      if (mm?.removeEventListener) mm.removeEventListener('change', onReduced);
      else mm?.removeListener?.(onReduced);
      try {
        if (ctx) ctx.onstatechange = null;
        ctx?.close().catch(() => undefined);
      } catch {
        /* ignore */
      }
    },
  };
}
