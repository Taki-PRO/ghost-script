import { describe, expect, it } from 'vitest';
import {
  AMBIENCE,
  DURATION_MS,
  FLOOR,
  LIMITER,
  MASTER_GAIN,
  RECIPES,
  STOP_PAD,
  buildVoice,
  fillNoise,
  outcomeSounds,
} from './recipes';
import type { SoundId } from './voices';
import { MockAudioContext, MockNode, createLog } from './audioMock';
import type { MockOptions } from './audioMock';

const ids = Object.keys(RECIPES) as SoundId[];
const peakSum = (id: SoundId) =>
  [...RECIPES[id].osc, ...RECIPES[id].noise].reduce((a, c) => a + c.peak, 0);

// Per-sound bounds from Requirement 3: [max peak sum, min ms, max ms].
const BOUNDS: Record<SoundId, [number, number, number]> = {
  'key-tap': [0.1, 40, 100],
  'key-wrong': [0.08, 60, 140],
  'ink-sweep': [0.04, 120, 300],
  'seal-thud': [0.2, 200, 400],
  'rest-clean': [0.12, 700, 1200],
  'rest-struggled': [0.09, 500, 800],
  'rest-gave-up': [0.08, 500, 1000],
};

describe('recipes', () => {
  it('has the master chain constants', () => {
    expect(MASTER_GAIN).toBe(0.5);
    expect(LIMITER).toEqual({ threshold: -18, knee: 6, ratio: 12, attack: 0.003, release: 0.25 });
    expect(FLOOR).toBe(0.0001);
  });

  it.each(ids)('%s stays inside its bounds', (id) => {
    const r = RECIPES[id];
    const [maxPeak, minMs, maxMs] = BOUNDS[id];
    expect(peakSum(id)).toBeLessThanOrEqual(maxPeak + 1e-9);
    const ms = DURATION_MS[id];
    expect(ms - r.delay * 1000).toBeGreaterThanOrEqual(minMs);
    expect(ms).toBeLessThanOrEqual(maxMs);
    for (const c of [...r.osc, ...r.noise]) {
      expect(c.peak).toBeLessThanOrEqual(0.2);
      expect(c.attack).toBeGreaterThanOrEqual(0.002);
      expect(c.end).toBeGreaterThan(c.attack);
      expect(c.end).toBeLessThanOrEqual(r.dur);
    }
    for (const n of r.noise) {
      expect(Math.max(n.f0, n.f1 ?? 0)).toBeLessThanOrEqual(6000);
    }
  });

  it('matches the design frequencies', () => {
    const tap = RECIPES['key-tap'].osc[0]!;
    const wrong = RECIPES['key-wrong'].osc[0]!;
    expect(tap.f0).toBe(260);
    expect(tap.f0).toBeGreaterThanOrEqual(180);
    expect(tap.f0).toBeLessThanOrEqual(320);
    expect(wrong.f0).toBeLessThanOrEqual(tap.f0 * 0.7);
    expect(RECIPES['key-tap'].noise[0]!.f0).toBe(1100);
    expect(RECIPES['key-wrong'].noise[0]!.f0).toBeLessThanOrEqual(500);
    const ink = RECIPES['ink-sweep'].noise[0]!;
    expect(ink.f1! - ink.f0).toBeLessThanOrEqual(1500);
    const thud = RECIPES['seal-thud'];
    expect(thud.osc[0]!.f0).toBe(90);
    expect(thud.osc[0]!.f1).toBe(50);
    expect(thud.noise[0]!.f0).toBeLessThanOrEqual(400);
    const gaveUp = RECIPES['rest-gave-up'].osc[0]!;
    expect([gaveUp.f0, gaveUp.f1, gaveUp.sweep]).toEqual([330, 196, 0.7]);
  });

  it('chimes share a fundamental and the octave is at most 0.4 of it', () => {
    const [f, p] = RECIPES['rest-clean'].osc;
    expect(f!.f0).toBe(RECIPES['rest-struggled'].osc[0]!.f0);
    expect(f!.f0).toBeGreaterThanOrEqual(262);
    expect(f!.f0).toBeLessThanOrEqual(330);
    expect(p!.f0).toBe(f!.f0 * 2);
    expect(p!.peak / f!.peak).toBeLessThanOrEqual(0.4);
    expect(RECIPES['rest-struggled'].osc).toHaveLength(1);
  });

  it('DURATION_MS counts delay plus envelope end', () => {
    expect(DURATION_MS['rest-clean']).toBe(1080);
    expect(DURATION_MS['key-tap']).toBe(80);
    expect(DURATION_MS['rest-gave-up']).toBe(800);
  });

  it('maps outcomes to sounds', () => {
    expect(outcomeSounds('clean')).toEqual(['seal-thud', 'rest-clean']);
    expect(outcomeSounds('struggled')).toEqual(['rest-struggled']);
    expect(outcomeSounds('gave-up')).toEqual(['rest-gave-up']);
  });

  it('AMBIENCE stays inside its bounds', () => {
    const a = AMBIENCE;
    expect(a.centre - a.depth).toBeGreaterThanOrEqual(350);
    expect(a.centre + a.depth).toBeLessThanOrEqual(650);
    expect(a.lfoHz).toBeGreaterThanOrEqual(0.05);
    expect(a.lfoHz).toBeLessThanOrEqual(0.15);
    expect(a.loopSeconds).toBeGreaterThanOrEqual(2);
    expect(a.loopSeconds).toBeLessThanOrEqual(4);
    expect(a.fadeIn).toBeGreaterThanOrEqual(1);
    expect(a.fadeIn).toBeLessThanOrEqual(2);
    expect(a.fadeOut).toBeGreaterThanOrEqual(0.3);
    expect(a.fadeOut).toBeLessThanOrEqual(0.6);
    expect(a.base + a.lfoGain).toBeLessThanOrEqual(0.03 + 1e-9);
  });

  it('fillNoise is deterministic, in range, and smoothing changes it', () => {
    const a = new Float32Array(64);
    const b = new Float32Array(64);
    const s = new Float32Array(64);
    fillNoise(a);
    fillNoise(b);
    fillNoise(s, true);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(s)).not.toEqual(Array.from(a));
    for (const v of [...a, ...s]) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('fillNoise fixed samples', () => {
  it('starts with the same four samples every run', () => {
    const a = new Float32Array(4);
    fillNoise(a);
    [-0.2822200358, -0.7881934643, 0.3505809605, 0.8358691334].forEach((v, i) => expect(a[i]).toBeCloseTo(v, 6));
    const s = new Float32Array(4);
    fillNoise(s, true);
    [-0.0846660137, -0.3126574457, -0.1762174219, 0.0921650529].forEach((v, i) => expect(s[i]).toBeCloseTo(v, 6));
  });
});

describe('buildVoice on the audio mock', () => {
  const T0 = 1;
  function setup(options: MockOptions = {}) {
    const ctx = new MockAudioContext(createLog(), {});
    const dest = ctx.createGain();
    const noise = ctx.createBuffer(1, 4, 44100);
    ctx.options = options;
    const sources = new Set<AudioScheduledSourceNode>();
    const build = (id: SoundId, t0 = T0) =>
      buildVoice(
        ctx as unknown as AudioContext,
        dest as unknown as AudioNode,
        RECIPES[id],
        noise as unknown as AudioBuffer,
        t0,
        sources,
      );
    const mine = () => ctx.nodes.filter((n) => n !== dest);
    return { ctx, dest, noise, sources, build, mine };
  }
  const reaches = (from: MockNode, to: MockNode): boolean => {
    const seen = new Set<MockNode>();
    const walk = (n: MockNode): boolean => n === to || (!seen.has(n) && !!seen.add(n) && n.connections.some(walk));
    return walk(from);
  };

  it.each(ids)('%s schedules the expected nodes and starts and stops every source', (id) => {
    const { ctx, dest, sources, build, mine } = setup();
    build(id);
    const r = RECIPES[id];
    const nodes = mine();
    const osc = nodes.filter((n) => n.kind === 'oscillator');
    const bufs = nodes.filter((n) => n.kind === 'bufferSource');
    const filters = nodes.filter((n) => n.kind === 'biquad');
    const gains = nodes.filter((n) => n.kind === 'gain');
    expect(osc).toHaveLength(r.osc.length);
    expect(bufs).toHaveLength(r.noise.length);
    expect(filters).toHaveLength(r.noise.length);
    expect(gains).toHaveLength(r.osc.length + r.noise.length);
    const t = T0 + r.delay;
    for (const src of [...osc, ...bufs]) {
      expect(src.started).toEqual([t]);
      expect(src.stopped).toHaveLength(1);
      expect(src.stopped[0]).toBeGreaterThan(t);
      // Ends at most 1,200 ms after the request, delay included.
      expect(src.stopped[0]! - STOP_PAD - T0).toBeLessThanOrEqual(1.2 + 1e-9);
      expect(reaches(src, dest)).toBe(true);
    }
    expect(ctx.log.sourceStarts).toHaveLength(osc.length + bufs.length);
    expect(ctx.log.sourceStops).toHaveLength(osc.length + bufs.length);
    expect(sources.size).toBe(osc.length + bufs.length);
    for (const src of bufs) expect(src.loop).toBe(true);
    // Each noise source goes through a filter of the recipe's type and Q.
    r.noise.forEach((n, i) => {
      const f = filters[i]!;
      expect(f.type).toBe(n.kind);
      expect(f.connections.some((c) => c.kind === 'gain')).toBe(true);
      expect(bufs[i]!.connections).toEqual([f]);
      expect(f.frequency.events[0]).toEqual({ method: 'setValueAtTime', args: [n.f0, t] });
      expect(f.Q.events[0]!.args).toEqual([n.q, t]);
      if (n.f1 !== undefined) {
        expect(f.frequency.events[1]).toEqual({ method: 'linearRampToValueAtTime', args: [n.f1, t + n.sweep!] });
      }
    });
    r.osc.forEach((o, i) => {
      expect(osc[i]!.type).toBe('sine');
      expect(osc[i]!.frequency.events[0]).toEqual({ method: 'setValueAtTime', args: [o.f0, t] });
    });
  });

  it.each(ids)('%s gain envelope starts at 0, rises no sooner than 2 ms and never exceeds the peak', (id) => {
    const { build, mine } = setup();
    build(id);
    const r = RECIPES[id];
    const t = T0 + r.delay;
    const comps = [...r.osc, ...r.noise];
    const gains = mine().filter((n) => n.kind === 'gain');
    expect(gains).toHaveLength(comps.length);
    gains.forEach((g, i) => {
      const c = comps[i]!;
      const ev = g.gain.events;
      expect(ev[0]).toEqual({ method: 'setValueAtTime', args: [0, t] });
      const rise = ev.find((e) => e.method === 'linearRampToValueAtTime')!;
      expect(rise.args[1]! - t).toBeGreaterThanOrEqual(0.002 - 1e-9);
      expect(rise.args[0]).toBe(c.peak);
      const last = ev[ev.length - 1]!;
      expect(last.method).toBe('exponentialRampToValueAtTime');
      expect(last.args[0]).toBe(FLOOR);
      expect(last.args[1]).toBeCloseTo(t + c.end, 9);
      for (const e of ev) {
        expect(e.args[0]).toBeGreaterThanOrEqual(0);
        expect(e.args[0]).toBeLessThanOrEqual(Math.max(c.peak, 0) + 1e-12);
        expect(e.args[0]).toBeLessThanOrEqual(0.2);
        expect(e.args[0]! * MASTER_GAIN).toBeLessThanOrEqual(0.1);
      }
    });
    const sumPeaks = gains.reduce((a, g) => a + Math.max(...g.gain.events.map((e) => e.args[0]!)), 0);
    expect(sumPeaks * MASTER_GAIN).toBeLessThanOrEqual(0.2 * MASTER_GAIN + 1e-9);
  });

  it('creates no buffer itself, so one noise buffer serves many voices', () => {
    const { ctx, noise, build, sources } = setup();
    for (let i = 0; i < 6; i++) build('ink-sweep', T0 + i);
    build('key-tap');
    build('seal-thud');
    expect(ctx.buffers).toEqual([noise]);
    const bufs = ctx.nodes.filter((n) => n.kind === 'bufferSource');
    expect(bufs).toHaveLength(8);
    for (const b of bufs) expect(b.buffer).toBe(noise);
    expect(sources.size).toBe(bufs.length + 2);
  });

  it('removes a source and disconnects its nodes when it ends', () => {
    const { build, mine, sources } = setup();
    build('rest-clean');
    const srcs = mine().filter((n) => n.kind === 'oscillator');
    srcs[0]!.end();
    expect(sources.size).toBe(1);
    srcs[1]!.end();
    expect(sources.size).toBe(0);
    for (const n of mine()) expect(n.connections).toEqual([]);
  });

  describe('a throwing node method', () => {
    it('stops the started sources, disconnects, and does not throw (filter creation fails)', () => {
      const { build, mine, sources, ctx } = setup({ throwOn: ['createBiquadFilter'] });
      expect(() => build('key-tap')).not.toThrow();
      const osc = mine().filter((n) => n.kind === 'oscillator');
      expect(osc).toHaveLength(1);
      expect(osc[0]!.started).toHaveLength(1);
      expect(osc[0]!.stopped.length).toBeGreaterThanOrEqual(1);
      expect(sources.size).toBe(0);
      // Nothing after the failing call was built or connected.
      expect(mine().some((n) => n.kind === 'bufferSource' || n.kind === 'biquad')).toBe(false);
      for (const n of mine()) expect(n.connections).toEqual([]);
      expect(ctx.log.sourceStarts).toHaveLength(1);
    });

    it('does not throw when start fails and leaves no live source', () => {
      const { build, mine, sources } = setup({ throwOn: ['start'] });
      expect(() => build('rest-clean')).not.toThrow();
      expect(sources.size).toBe(0);
      expect(mine().filter((n) => n.kind === 'oscillator')).toHaveLength(1);
      for (const n of mine()) expect(n.connections).toEqual([]);
    });

    it('does not throw when stop fails', () => {
      const { build, mine, sources } = setup({ throwOn: ['stop'] });
      expect(() => build('key-tap')).not.toThrow();
      expect(sources.size).toBe(0);
      for (const n of mine()) expect(n.connections).toEqual([]);
    });

    it('does not throw when connect fails and builds nothing further', () => {
      const { build, mine, sources } = setup({ throwOn: ['connect'] });
      expect(() => build('seal-thud')).not.toThrow();
      expect(sources.size).toBe(0);
      expect(mine().filter((n) => n.kind === 'oscillator' || n.kind === 'bufferSource')).toHaveLength(0);
    });

    it('does not throw when createOscillator and disconnect both fail', () => {
      const { build, sources } = setup({ throwOn: ['createOscillator', 'disconnect'] });
      expect(() => build('rest-gave-up')).not.toThrow();
      expect(sources.size).toBe(0);
    });

    it('stops the first source when the second one fails', () => {
      const { ctx, build, mine, sources } = setup();
      let calls = 0;
      const real = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = () => {
        if (++calls === 2) throw new Error('second oscillator failed');
        return real();
      };
      expect(() => build('rest-clean')).not.toThrow();
      const osc = mine().filter((n) => n.kind === 'oscillator');
      expect(osc).toHaveLength(1);
      expect(osc[0]!.stopped.length).toBeGreaterThanOrEqual(1);
      expect(sources.size).toBe(0);
      for (const n of mine()) expect(n.connections).toEqual([]);
    });
  });
});
