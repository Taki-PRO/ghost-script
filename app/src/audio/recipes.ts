// Synth recipes for the night sounds: data plus small builders. No React, no audio files,
// no fetch, no Audio element. Times are in seconds, gains are linear before MASTER_GAIN.
// No function here takes a character, a code, a key name or a stroke.
import type { SoundId } from './voices';

export const MASTER_GAIN = 0.5;
export const LIMITER = { threshold: -18, knee: 6, ratio: 12, attack: 0.003, release: 0.25 } as const;
export const FLOOR = 0.0001;
/** A source stops this long after its envelope end, when the gain is already at FLOOR. */
export const STOP_PAD = 0.02;

export interface Osc {
  type: 'sine';
  f0: number;
  f1?: number;
  sweep?: number;
  peak: number;
  attack: number;
  end: number;
}
export interface Noise {
  kind: 'bandpass' | 'lowpass';
  f0: number;
  f1?: number;
  sweep?: number;
  q: number;
  peak: number;
  attack: number;
  end: number;
}
export interface Recipe {
  delay: number;
  dur: number;
  osc: readonly Osc[];
  noise: readonly Noise[];
}

const sine = (f0: number, peak: number, attack: number, end: number, f1?: number, sweep?: number): Osc => ({
  type: 'sine',
  f0,
  f1,
  sweep,
  peak,
  attack,
  end,
});

export const RECIPES: Readonly<Record<SoundId, Recipe>> = {
  'key-tap': {
    delay: 0,
    dur: 0.08,
    osc: [sine(260, 0.07, 0.003, 0.075, 200, 0.06)],
    noise: [{ kind: 'bandpass', f0: 1100, q: 1.2, peak: 0.03, attack: 0.002, end: 0.025 }],
  },
  'key-wrong': {
    delay: 0,
    dur: 0.11,
    osc: [sine(140, 0.06, 0.004, 0.105, 120, 0.08)],
    noise: [{ kind: 'lowpass', f0: 380, q: 0.7, peak: 0.02, attack: 0.003, end: 0.05 }],
  },
  'ink-sweep': {
    delay: 0,
    dur: 0.22,
    osc: [],
    noise: [{ kind: 'bandpass', f0: 2200, f1: 3400, sweep: 0.2, q: 0.9, peak: 0.035, attack: 0.04, end: 0.22 }],
  },
  'seal-thud': {
    delay: 0,
    dur: 0.3,
    osc: [sine(90, 0.15, 0.004, 0.3, 50, 0.18)],
    noise: [{ kind: 'lowpass', f0: 320, q: 0.7, peak: 0.04, attack: 0.003, end: 0.12 }],
  },
  'rest-clean': {
    delay: 0.18,
    dur: 0.9,
    osc: [sine(294, 0.09, 0.012, 0.9), sine(588, 0.03, 0.012, 0.5)],
    noise: [],
  },
  'rest-struggled': {
    delay: 0,
    dur: 0.6,
    osc: [sine(294, 0.07, 0.012, 0.6)],
    noise: [],
  },
  'rest-gave-up': {
    delay: 0,
    dur: 0.8,
    osc: [sine(330, 0.06, 0.02, 0.8, 196, 0.7)],
    noise: [],
  },
};

/** The night wind: looped smoothed noise, band-pass, one slow LFO on the centre and the gain. */
export const AMBIENCE = {
  loopSeconds: 3,
  centre: 500,
  depth: 150,
  lfoHz: 0.1,
  q: 0.8,
  base: 0.02,
  lfoGain: 0.01,
  fadeIn: 1.5,
  fadeOut: 0.45,
} as const;

/** Delay plus envelope end, in whole milliseconds; the voice limiter counts from the request. */
export const DURATION_MS: Readonly<Record<SoundId, number>> = Object.fromEntries(
  (Object.keys(RECIPES) as SoundId[]).map((id) => [id, Math.round((RECIPES[id].delay + RECIPES[id].dur) * 1000)]),
) as Record<SoundId, number>;

/** The only mapping from a game result to sounds. Takes the outcome and nothing else. */
export function outcomeSounds(outcome: 'clean' | 'struggled' | 'gave-up'): readonly SoundId[] {
  if (outcome === 'clean') return ['seal-thud', 'rest-clean'];
  return [outcome === 'struggled' ? 'rest-struggled' : 'rest-gave-up'];
}

/** Fixed-seed (mulberry32) noise in [-1, 1]. `smooth` low-passes it for the wind. Same samples every run. */
export function fillNoise(out: Float32Array, smooth = false): void {
  let s = 0x9e3779b9;
  let y = 0;
  for (let i = 0; i < out.length; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const x = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    if (smooth) {
      y += 0.1 * (x - y);
      out[i] = Math.max(-1, Math.min(1, y * 3));
    } else {
      out[i] = x;
    }
  }
}

/**
 * Builds and starts one effect voice at t0 + recipe.delay. Every started source is added to
 * `sources` and removed when it ends. A node method that throws drops the voice: its nodes
 * are released and nothing is thrown.
 */
export function buildVoice(
  ctx: AudioContext,
  dest: AudioNode,
  r: Recipe,
  noise: AudioBuffer,
  t0: number,
  sources: Set<AudioScheduledSourceNode>,
): void {
  const t = t0 + r.delay;
  const nodes: AudioNode[] = [];
  const started: AudioScheduledSourceNode[] = [];
  const envelope = (peak: number, attack: number, end: number): GainNode => {
    const g = ctx.createGain();
    nodes.push(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + end);
    g.connect(dest);
    return g;
  };
  const glide = (p: AudioParam, f0: number, f1: number | undefined, sweep = 0) => {
    p.setValueAtTime(f0, t);
    if (f1 !== undefined) p.linearRampToValueAtTime(f1, t + sweep);
  };
  const run = (src: AudioScheduledSourceNode, end: number) => {
    nodes.push(src);
    src.start(t);
    started.push(src);
    src.stop(t + end + STOP_PAD);
    sources.add(src);
    src.onended = () => {
      sources.delete(src);
      for (const n of nodes) n.disconnect();
    };
  };
  try {
    for (const o of r.osc) {
      const g = envelope(o.peak, o.attack, o.end);
      const src = ctx.createOscillator();
      src.type = o.type;
      glide(src.frequency, o.f0, o.f1, o.sweep);
      src.connect(g);
      run(src, o.end);
    }
    for (const n of r.noise) {
      const g = envelope(n.peak, n.attack, n.end);
      const f = ctx.createBiquadFilter();
      nodes.push(f);
      f.type = n.kind;
      f.Q.setValueAtTime(n.q, t);
      glide(f.frequency, n.f0, n.f1, n.sweep);
      f.connect(g);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.connect(f);
      run(src, n.end);
    }
  } catch {
    for (const s of started) {
      sources.delete(s);
      try {
        s.stop();
      } catch {
        /* already dropped */
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* already dropped */
      }
    }
  }
}
