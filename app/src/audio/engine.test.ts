import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundEngine, isWebAudioAvailable, type EngineDeps, type SoundEngine } from './engine';
import { AMBIENCE, DURATION_MS, LIMITER, MASTER_GAIN, RECIPES } from './recipes';
import { MAX_KEY_INK_VOICES, MAX_PER_ID, MAX_VOICES, type SoundId } from './voices';
import { MockNode, createMock, installAudioMock, type MockAudioContext, type MockHandle, type MockOptions } from './audioMock';

type Listener = (e?: unknown) => void;
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

function fakeDoc() {
  const handlers = new Map<string, Listener[]>();
  const add = vi.fn((type: string, fn: Listener, _opts?: unknown) => {
    handlers.set(type, [...(handlers.get(type) ?? []), fn]);
  });
  const remove = vi.fn((type: string, fn: Listener, _opts?: unknown) => {
    handlers.set(type, (handlers.get(type) ?? []).filter((f) => f !== fn));
  });
  const doc = { visibilityState: 'visible' as 'visible' | 'hidden', addEventListener: add, removeEventListener: remove };
  return {
    doc,
    add,
    remove,
    fire(type: string) {
      for (const f of [...(handlers.get(type) ?? [])]) f();
    },
    hide() {
      doc.visibilityState = 'hidden';
      this.fire('visibilitychange');
    },
    show() {
      doc.visibilityState = 'visible';
      this.fire('visibilitychange');
    },
    live() {
      let n = 0;
      for (const l of handlers.values()) n += l.length;
      return n;
    },
  };
}

function fakeMq(matches: boolean, legacy = false) {
  let ls: Listener[] = [];
  const mq = {
    matches,
    addEventListener: vi.fn((_t: string, l: Listener) => {
      ls.push(l);
    }),
    removeEventListener: vi.fn((_t: string, l: Listener) => {
      ls = ls.filter((x) => x !== l);
    }),
    addListener: vi.fn((l: Listener) => {
      ls.push(l);
    }),
    removeListener: vi.fn((l: Listener) => {
      ls = ls.filter((x) => x !== l);
    }),
  };
  const handle = {
    mq: (legacy ? { matches, addListener: mq.addListener, removeListener: mq.removeListener } : mq) as typeof mq,
    raw: mq,
    set(m: boolean) {
      mq.matches = m;
      (handle.mq as { matches: boolean }).matches = m;
      for (const l of [...ls]) l();
    },
    count: () => ls.length,
  };
  return handle;
}

let clock = 0;
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

interface Rig {
  eng: SoundEngine;
  mock: MockHandle;
  d: ReturnType<typeof fakeDoc>;
  m: ReturnType<typeof fakeMq>;
  ctx: () => MockAudioContext;
  gesture: (type?: string) => void;
}

function rig(opts: MockOptions = {}, o: { reduced?: boolean; legacyMq?: boolean; deps?: Partial<EngineDeps> } = {}): Rig {
  const mock = createMock(opts);
  const d = fakeDoc();
  const m = fakeMq(o.reduced ?? false, o.legacyMq ?? false);
  const eng = createSoundEngine({
    createContext: () => mock.create() as unknown as AudioContext,
    now: () => clock,
    doc: d.doc as unknown as Document,
    matchMedia: () => m.mq as never,
    ...o.deps,
  });
  return {
    eng,
    mock,
    d,
    m,
    ctx: () => {
      const c = mock.last;
      if (!c) throw new Error('no context built');
      return c;
    },
    gesture: (type = 'click') => d.fire(type),
  };
}

/** A running engine: gesture, resume settled. */
async function running(opts: MockOptions = {}, o: Parameters<typeof rig>[1] = {}): Promise<Rig> {
  const r = rig(opts, o);
  r.gesture();
  await flush();
  return r;
}

const windStarts = (r: Rig) =>
  r.mock.log.sourceStarts.filter((s) => s.kind === 'bufferSource' && s.node.buffer?.duration === AMBIENCE.loopSeconds);

beforeEach(() => {
  clock = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('construction and gestures (R2.1 to R2.6)', () => {
  it('builds no context at creation, at play before a gesture, or while disabled', () => {
    const r = rig();
    expect(r.mock.log.constructions).toBe(0);
    r.eng.play('key-tap');
    r.eng.setAmbience(true);
    expect(r.mock.log.constructions).toBe(0);
    expect(r.mock.log.sourceStarts).toHaveLength(0);

    const off = rig();
    off.eng.setEnabled(false);
    for (const g of GESTURES) off.gesture(g);
    off.eng.unlock();
    off.eng.play('key-tap');
    expect(off.mock.log.constructions).toBe(0);
    expect(off.mock.log.sourceStarts).toHaveLength(0);
  });

  it.each(GESTURES)('the first %s builds exactly one context and resumes once', async (type) => {
    const r = rig();
    r.gesture(type);
    expect(r.mock.log.constructions).toBe(1);
    expect(r.mock.log.resumeCalls).toBe(1);
    await flush();
    expect(r.ctx().state).toBe('running');
  });

  it('registers the gesture listeners as capture and passive', () => {
    const r = rig();
    for (const g of GESTURES) {
      expect(r.d.add).toHaveBeenCalledWith(g, expect.any(Function), { capture: true, passive: true });
    }
    expect(r.d.add).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('a gesture while running does not call resume; a fresh running context needs none', async () => {
    const r = await running();
    r.gesture('keydown');
    r.gesture('click');
    expect(r.mock.log.constructions).toBe(1);
    expect(r.mock.log.resumeCalls).toBe(1);

    const born = rig({ initialState: 'running' });
    born.gesture();
    expect(born.mock.log.resumeCalls).toBe(0);
  });

  it.each(['suspended', 'interrupted'] as const)('one resume() per gesture while %s', async (state) => {
    const r = rig({ initialState: state, stateAfterResume: state });
    r.gesture();
    await flush();
    r.gesture();
    await flush();
    r.gesture();
    expect(r.mock.log.constructions).toBe(1);
    expect(r.mock.log.resumeCalls).toBe(3);
  });

  it('setEnabled(true) then unlock() builds the context in the same call', () => {
    const r = rig();
    r.eng.setEnabled(false);
    r.eng.setEnabled(true);
    expect(r.mock.log.constructions).toBe(0);
    r.eng.unlock();
    expect(r.mock.log.constructions).toBe(1);
    expect(r.mock.log.resumeCalls).toBe(1);
  });

  it('a gesture while disabled builds nothing and is not remembered', () => {
    const r = rig();
    r.eng.setEnabled(false);
    r.gesture();
    r.eng.setEnabled(true);
    expect(r.mock.log.constructions).toBe(0);
  });

  it('turning sound back on after a gesture resumes at once', async () => {
    const r = await running();
    r.eng.setEnabled(false);
    await flush();
    expect(r.ctx().state).toBe('suspended');
    r.eng.setEnabled(true);
    expect(r.mock.log.resumeCalls).toBe(2);
    expect(r.mock.log.constructions).toBe(1);
    await flush();
    clock = 1000;
    r.eng.play('seal-thud');
    expect(r.mock.log.sourceStarts.length).toBeGreaterThan(0);
  });

  it('works with webkitAudioContext only', async () => {
    const h = installAudioMock({}, 'webkit');
    try {
      expect(isWebAudioAvailable()).toBe(true);
      const d = fakeDoc();
      const eng = createSoundEngine({ doc: d.doc as unknown as Document, now: () => clock, matchMedia: () => fakeMq(false).mq as never });
      d.fire('click');
      await flush();
      expect(h.log.constructions).toBe(1);
      eng.play('key-tap');
      expect(h.log.sourceStarts.length).toBeGreaterThan(0);
    } finally {
      h.restore();
    }
  });

  it('reports no Web Audio and plays silently when neither constructor exists', () => {
    const h = installAudioMock({}, 'webkit');
    try {
      delete (globalThis as { webkitAudioContext?: unknown }).webkitAudioContext;
      expect(isWebAudioAvailable()).toBe(false);
      const d = fakeDoc();
      const eng = createSoundEngine({ doc: d.doc as unknown as Document, now: () => clock, matchMedia: () => fakeMq(false).mq as never });
      expect(() => {
        d.fire('click');
        eng.play('key-tap');
        eng.setAmbience(true);
      }).not.toThrow();
      expect(h.log.constructions).toBe(0);
    } finally {
      h.restore();
    }
  });
});

describe('master chain (R8.1 to R8.3)', () => {
  it('wires gain 0.5, then the compressor, then the destination', () => {
    const r = rig();
    r.gesture();
    const [gain, comp] = r.ctx().nodes;
    expect(gain.kind).toBe('gain');
    expect(gain.gain.value).toBe(MASTER_GAIN);
    expect(comp.kind).toBe('compressor');
    expect(gain.connections).toEqual([comp]);
    expect(comp.connections).toEqual([r.ctx().destination]);
    expect(comp.threshold.value).toBe(LIMITER.threshold);
    expect(comp.knee.value).toBe(LIMITER.knee);
    expect(comp.ratio.value).toBe(LIMITER.ratio);
    expect(comp.attack.value).toBe(LIMITER.attack);
    expect(comp.release.value).toBe(LIMITER.release);
  });

  it('routes every voice into the master gain', async () => {
    const r = await running();
    const master = r.ctx().nodes[0];
    r.eng.play('key-tap');
    const voiceGains = r.ctx().nodes.filter((n) => n.kind === 'gain' && n !== master);
    expect(voiceGains.length).toBeGreaterThan(0);
    for (const g of voiceGains) expect(g.connections).toEqual([master]);
  });
});

describe('play gating (R2.7, R2.8)', () => {
  it('plays while running and drops while suspended outside the resume window', async () => {
    const r = await running();
    clock = 5000;
    r.eng.play('seal-thud');
    const started = r.mock.log.sourceStarts.length;
    expect(started).toBeGreaterThan(0);
    r.ctx().setState('suspended');
    r.eng.play('rest-struggled');
    expect(r.mock.log.sourceStarts).toHaveLength(started);
  });

  it('accepts play for 300 ms after the resume call, then drops', () => {
    const r = rig({ resume: 'hang' });
    clock = 1000;
    r.gesture();
    clock = 1299;
    r.eng.play('seal-thud');
    const started = r.mock.log.sourceStarts.length;
    expect(started).toBeGreaterThan(0);
    clock = 1300;
    r.eng.play('rest-struggled');
    expect(r.mock.log.sourceStarts).toHaveLength(started);
  });

  it('drops play for a closed context', async () => {
    const r = await running();
    r.ctx().setState('closed');
    r.eng.play('seal-thud');
    expect(r.mock.log.sourceStarts).toHaveLength(0);

    const born = rig({ initialState: 'closed' });
    born.gesture();
    born.eng.play('seal-thud');
    expect(born.mock.log.resumeCalls).toBe(0);
    expect(born.mock.log.sourceStarts).toHaveLength(0);
  });

  it('a hidden document stops sources and suspends; play is dropped; visible resumes', async () => {
    const r = await running();
    r.eng.play('seal-thud');
    const started = r.mock.log.sourceStarts.length;
    r.d.hide();
    expect(r.mock.log.sourceStops.length).toBeGreaterThanOrEqual(started);
    expect(r.mock.log.suspendCalls).toBe(1);
    await flush();
    expect(r.ctx().state).toBe('suspended');
    clock = 1000;
    r.eng.play('rest-struggled');
    expect(r.mock.log.sourceStarts).toHaveLength(started);

    r.d.show();
    expect(r.mock.log.resumeCalls).toBe(2);
    await flush();
    expect(r.ctx().state).toBe('running');
    clock = 2000;
    r.eng.play('rest-struggled');
    expect(r.mock.log.sourceStarts.length).toBeGreaterThan(started);
  });

  it('becoming visible without a gesture does not build or resume anything', () => {
    const r = rig();
    r.d.hide();
    r.d.show();
    expect(r.mock.log.constructions).toBe(0);
    expect(r.mock.log.resumeCalls).toBe(0);
  });

  it('setEnabled(false) stops sources and suspends, and play stays silent', async () => {
    const r = await running();
    r.eng.play('seal-thud');
    const started = r.mock.log.sourceStarts.length;
    r.eng.setEnabled(false);
    expect(r.mock.log.sourceStops.length).toBeGreaterThanOrEqual(started);
    expect(r.mock.log.suspendCalls).toBe(1);
    await flush();
    clock = 1000;
    r.eng.play('rest-struggled');
    expect(r.mock.log.sourceStarts).toHaveLength(started);
    expect(r.mock.log.constructions).toBe(1);
  });
});

describe('failure paths (R2.9, R2.10, R9.6)', () => {
  it('a constructor that throws breaks the engine for good, silently', () => {
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const r = rig({ ctorThrows: new Error('blocked') });
    expect(() => {
      r.gesture('click');
      r.gesture('keydown');
      r.eng.unlock();
      r.eng.setEnabled(false);
      r.eng.setEnabled(true);
      r.eng.unlock();
      r.eng.play('key-tap');
      r.eng.setAmbience(true);
    }).not.toThrow();
    expect(r.mock.log.constructions).toBe(1);
    expect(r.mock.log.sourceStarts).toHaveLength(0);
    for (const s of consoleSpies) expect(s).not.toHaveBeenCalled();
  });

  it('a resume() rejection is silent, drops play, and the next gesture retries', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    vi.useRealTimers();
    try {
      const r = rig({ resume: 'reject' });
      r.gesture();
      await flush();
      clock = 10_000;
      r.eng.play('seal-thud');
      expect(r.mock.log.sourceStarts).toHaveLength(0);
      r.gesture();
      expect(r.mock.log.resumeCalls).toBe(2);
      expect(r.mock.log.constructions).toBe(1);
      await flush();
      await new Promise((res) => setTimeout(res, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('a throwing node drops that voice and stops what already started', async () => {
    const r = await running({ throwOn: ['createBufferSource'] });
    expect(() => r.eng.play('key-tap')).not.toThrow();
    const started = [...r.mock.log.sourceStarts];
    expect(started.length).toBeGreaterThan(0);
    // The oscillator started before the noise source failed; it must have been stopped by the drop.
    for (const s of started) expect(r.mock.log.sourceStops.some((x) => x.node === s.node)).toBe(true);
    // The engine still works for a voice that needs no buffer source.
    clock = 5000;
    r.eng.play('rest-struggled');
    expect(r.mock.log.sourceStarts.length).toBeGreaterThan(started.length);
  });

  it('a throwing master chain breaks the engine without throwing', () => {
    const r = rig({ throwOn: ['createDynamicsCompressor'] });
    expect(() => {
      r.gesture();
      r.gesture();
      r.eng.play('key-tap');
    }).not.toThrow();
    expect(r.mock.log.sourceStarts).toHaveLength(0);
  });

  it('is silent when matchMedia is missing or throws', async () => {
    const r = rig({}, { deps: { matchMedia: () => { throw new Error('no matchMedia'); } } });
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    expect(windStarts(r)).toHaveLength(1);
    expect(() => r.eng.dispose()).not.toThrow();

    const bare = rig({}, { deps: { matchMedia: undefined } });
    expect(() => {
      bare.gesture();
      bare.eng.dispose();
    }).not.toThrow();
  });
});

describe('voice limits through the engine (R7)', () => {
  it('accepts a burst up to the limits and drops the rest without queueing', () => {
    const r = rig({ initialState: 'running' });
    r.gesture();
    clock = 0;
    const sizes: number[] = [];
    const play = (id: SoundId) => {
      const before = r.mock.log.sourceStarts.length;
      r.eng.play(id);
      sizes.push(r.mock.log.sourceStarts.length - before);
    };
    play('key-tap'); // accepted: 1 osc + 1 noise
    play('key-wrong'); // accepted: 2
    play('ink-sweep'); // accepted: 1 (third key/ink voice)
    play('key-tap'); // dropped: spacing
    play('seal-thud'); // accepted: fourth voice, 2 sources
    play('rest-clean'); // dropped: total
    expect(sizes).toEqual([2, 2, 1, 0, 2, 0]);
    const started = r.mock.log.sourceStarts.length;
    vi.advanceTimersByTime(10_000);
    expect(r.mock.log.sourceStarts).toHaveLength(started);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fast key presses never exceed the voice limits', () => {
    const r = rig({ initialState: 'running' });
    r.gesture();
    const pattern: SoundId[] = ['key-tap', 'key-wrong', 'ink-sweep', 'key-tap', 'ink-sweep', 'seal-thud', 'key-wrong'];
    const accepted: { id: SoundId; t: number }[] = [];
    for (let i = 0; i < 300; i++) {
      clock = i * 7;
      const id = pattern[i % pattern.length];
      const before = r.mock.log.sourceStarts.length;
      r.eng.play(id);
      if (r.mock.log.sourceStarts.length > before) accepted.push({ id, t: clock });
    }
    expect(accepted.length).toBeGreaterThan(0);
    expect(accepted.length).toBeLessThan(300);
    const keyInk = (id: SoundId) => id === 'key-tap' || id === 'key-wrong' || id === 'ink-sweep';
    for (const a of accepted) {
      const live = accepted.filter((b) => b.t <= a.t && b.t + DURATION_MS[b.id] > a.t);
      expect(live.length).toBeLessThanOrEqual(MAX_VOICES);
      expect(live.filter((b) => keyInk(b.id)).length).toBeLessThanOrEqual(MAX_KEY_INK_VOICES);
      expect(live.filter((b) => b.id === a.id && keyInk(b.id)).length).toBeLessThanOrEqual(MAX_PER_ID);
    }
  });

  it('a dropped request starts no timer and leaves the spacing clock alone', async () => {
    const r = await running();
    const timers = vi.getTimerCount();
    clock = 0;
    r.eng.play('key-tap');
    const afterFirst = r.mock.log.sourceStarts.length;
    clock = 30;
    r.eng.play('key-tap'); // dropped: spacing
    expect(r.mock.log.sourceStarts).toHaveLength(afterFirst);
    expect(vi.getTimerCount()).toBe(timers);
    clock = 41; // 41 ms after the last accepted request, not after the dropped one
    r.eng.play('key-tap');
    expect(r.mock.log.sourceStarts.length).toBeGreaterThan(afterFirst);
    expect(vi.getTimerCount()).toBe(timers);
  });

  it('drops play before a gesture without any timer', () => {
    const r = rig();
    const timers = vi.getTimerCount();
    r.eng.play('key-tap');
    expect(vi.getTimerCount()).toBe(timers);
  });
});

describe('the wind (R9.1 to R9.3)', () => {
  const nodesAfterMaster = (r: Rig) => r.ctx().nodes.slice(2);

  it('starts when everything holds, as one looping 3 s buffer source', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    expect(r.mock.log.constructions).toBe(0);
    r.gesture();
    await flush();
    const w = windStarts(r);
    expect(w).toHaveLength(1);
    expect(w[0].node.loop).toBe(true);
    expect(w[0].node.buffer?.duration).toBe(3);
  });

  it('does not start when sound is off', async () => {
    const r = rig();
    r.eng.setEnabled(false);
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    expect(r.mock.log.constructions).toBe(0);
    expect(windStarts(r)).toHaveLength(0);
  });

  it('does not start when it is not wanted', async () => {
    const r = await running();
    expect(windStarts(r)).toHaveLength(0);
    r.eng.setAmbience(false);
    expect(windStarts(r)).toHaveLength(0);
  });

  it('does not start before a gesture', () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.eng.setAmbience(true);
    expect(r.mock.log.constructions).toBe(0);
    expect(r.mock.log.sourceStarts).toHaveLength(0);
  });

  it('does not start while the context is not running', async () => {
    const r = rig({ resume: 'hang' });
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    expect(r.ctx().state).toBe('suspended');
    expect(windStarts(r)).toHaveLength(0);
  });

  it('does not start while hidden, and starts when visible again', async () => {
    const r = rig();
    r.d.doc.visibilityState = 'hidden';
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    expect(windStarts(r)).toHaveLength(0);
    r.d.show();
    await flush();
    expect(windStarts(r)).toHaveLength(1);
  });

  it('does not start under reduced motion, and starts when the preference clears', async () => {
    const r = rig({}, { reduced: true });
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    expect(windStarts(r)).toHaveLength(0);
    r.m.set(false);
    expect(windStarts(r)).toHaveLength(1);
  });

  it('a live reduced-motion change stops the wind and a change back restarts it', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    const first = windStarts(r)[0].node;
    r.m.set(true);
    expect(r.mock.log.sourceStops.some((s) => s.node === first)).toBe(true);
    r.m.set(false);
    const w = windStarts(r);
    expect(w).toHaveLength(2);
    expect(w[1].node).not.toBe(first);
  });

  it('follows reduced motion through the legacy addListener API', async () => {
    const r = rig({}, { legacyMq: true });
    expect(r.m.raw.addListener).toHaveBeenCalledTimes(1);
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    expect(windStarts(r)).toHaveLength(1);
    r.m.set(true);
    expect(r.mock.log.sourceStops.some((s) => s.node === windStarts(r)[0].node)).toBe(true);
    r.eng.dispose();
    expect(r.m.raw.removeListener).toHaveBeenCalledTimes(1);
    expect(r.m.count()).toBe(0);
  });

  it('a second setAmbience(true) does not restart it', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    const nodes = r.ctx().nodes.length;
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    expect(windStarts(r)).toHaveLength(1);
    expect(r.ctx().nodes).toHaveLength(nodes);
  });

  it('setAmbience(false) fades out in 0.45 s and releases the nodes when the source ends', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    const src = windStarts(r)[0].node;
    const windNodes = nodesAfterMaster(r);
    const gain = windNodes.find((n) => n.kind === 'gain' && n.gain.events.some((e) => e.method === 'linearRampToValueAtTime' && e.args[0] === AMBIENCE.base));
    expect(gain).toBeDefined();
    r.eng.setAmbience(false);
    const ramp = gain!.gain.events.filter((e) => e.method === 'linearRampToValueAtTime').pop()!;
    expect(ramp.args).toEqual([0, AMBIENCE.fadeOut]);
    expect(gain!.gain.events.some((e) => e.method === 'cancelScheduledValues')).toBe(true);
    const stop = r.mock.log.sourceStops.find((s) => s.node === src)!;
    expect(stop.when).toBeGreaterThan(AMBIENCE.fadeOut);
    for (const n of windNodes) expect(n.disconnects).toHaveLength(0);
    src.end();
    for (const n of windNodes) expect(n.disconnects.length).toBeGreaterThan(0);
    r.eng.setAmbience(false);
    expect(windStarts(r)).toHaveLength(1);
  });

  it('setEnabled(false) stops the wind and releases its nodes at once', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    const windNodes = nodesAfterMaster(r);
    r.eng.setEnabled(false);
    expect(r.mock.log.sourceStops.some((s) => s.node === windStarts(r)[0].node)).toBe(true);
    for (const n of windNodes) expect(n.disconnects.length).toBeGreaterThan(0);
  });

  it('fades in over 1.5 s and keeps base plus LFO gain at most 0.03', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    const gains = nodesAfterMaster(r).filter((n) => n.kind === 'gain');
    const main = gains.find((n) => n.gain.events.some((e) => e.method === 'linearRampToValueAtTime'))!;
    const rampIn = main.gain.events.find((e) => e.method === 'linearRampToValueAtTime')!;
    expect(rampIn.args).toEqual([AMBIENCE.base, AMBIENCE.fadeIn]);
    const lfoGain = gains.find((n) => n !== main && n.connections.includes(main) === false && n.gain.value === AMBIENCE.lfoGain)!;
    expect(lfoGain).toBeDefined();
    expect(AMBIENCE.base + lfoGain.gain.value).toBeLessThanOrEqual(0.03 + 1e-12);
  });

  it('builds the wind buffer once and it is 3 s long', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    r.m.set(true);
    r.m.set(false);
    r.eng.setAmbience(false);
    r.eng.setAmbience(true);
    expect(windStarts(r)).toHaveLength(3);
    const long = r.ctx().buffers.filter((b) => b.duration === 3);
    expect(long).toHaveLength(1);
    expect(r.ctx().buffers).toHaveLength(1);
  });

  it('builds the effect noise buffer lazily, once, at 1 s', async () => {
    const r = await running();
    expect(r.ctx().buffers).toHaveLength(0);
    r.eng.play('key-tap');
    clock = 100;
    r.eng.play('key-tap');
    expect(r.ctx().buffers).toHaveLength(1);
    expect(r.ctx().buffers[0].duration).toBe(1);
  });
});

describe('dispose (R2.4)', () => {
  it('removes the four gesture listeners, the visibility listener and the media listener', async () => {
    const r = rig();
    const added = r.d.add.mock.calls.length;
    expect(added).toBe(5);
    expect(r.m.raw.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    r.eng.dispose();
    expect(r.d.remove).toHaveBeenCalledTimes(5);
    for (const g of GESTURES) expect(r.d.remove).toHaveBeenCalledWith(g, expect.any(Function), { capture: true });
    expect(r.d.remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(r.m.raw.removeEventListener).toHaveBeenCalledTimes(1);
    expect(r.d.live()).toBe(0);
    expect(r.m.count()).toBe(0);
    r.gesture();
    expect(r.mock.log.constructions).toBe(0);
  });

  it('removes the same functions it added', () => {
    const r = rig();
    const addedFns = r.d.add.mock.calls.map((c) => c[1]);
    r.eng.dispose();
    for (const c of r.d.remove.mock.calls) expect(addedFns).toContain(c[1]);
  });

  it('closes the context, stops sources and the wind, and ignores later calls', async () => {
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    r.eng.play('seal-thud');
    const started = r.mock.log.sourceStarts.length;
    r.eng.dispose();
    expect(r.mock.log.closeCalls).toBe(1);
    expect(r.mock.log.sourceStops.length).toBeGreaterThanOrEqual(started);
    await flush();
    clock = 5000;
    r.eng.play('rest-struggled');
    r.eng.setEnabled(true);
    r.eng.setAmbience(true);
    r.eng.unlock();
    r.eng.dispose();
    expect(r.mock.log.sourceStarts).toHaveLength(started);
    expect(r.mock.log.closeCalls).toBe(1);
    expect(r.mock.log.constructions).toBe(1);
  });

  it('disposing before any gesture closes nothing and throws nothing', () => {
    const r = rig();
    expect(() => r.eng.dispose()).not.toThrow();
    expect(r.mock.log.closeCalls).toBe(0);
  });

  it('swallows a close() failure', () => {
    const r = rig({ throwOn: ['close'] });
    r.gesture();
    expect(() => r.eng.dispose()).not.toThrow();
  });
});

describe('no identity, no storage, no console (R11, R21.3)', () => {
  it('play takes only a sound id: the node graph for a sound is identical every time', async () => {
    const record = async () => {
      clock = 0;
      const r = await running({ initialState: 'running' });
      (['key-tap', 'key-wrong', 'ink-sweep', 'seal-thud', 'rest-clean'] as SoundId[]).forEach((id) => r.eng.play(id));
      return r.ctx().nodes.map((n: MockNode) => ({
        kind: n.kind,
        type: n.type,
        params: Object.fromEntries(Object.entries(n.params).map(([k, p]) => [k, p.events])),
      }));
    };
    const a = await record();
    const b = await record();
    expect(a.length).toBeGreaterThan(2);
    expect(a).toEqual(b);
    expect(createSoundEngine({ doc: fakeDoc().doc as unknown as Document, matchMedia: () => fakeMq(false).mq as never }).play.length).toBe(1);
  });

  it('never touches storage or the console across a full flow', async () => {
    const storage = [
      vi.spyOn(Storage.prototype, 'getItem'),
      vi.spyOn(Storage.prototype, 'setItem'),
      vi.spyOn(Storage.prototype, 'removeItem'),
      vi.spyOn(Storage.prototype, 'clear'),
    ];
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const r = rig();
    r.eng.setAmbience(true);
    r.gesture();
    await flush();
    r.eng.play('key-tap');
    r.d.hide();
    r.d.show();
    r.eng.setEnabled(false);
    r.eng.setEnabled(true);
    r.m.set(true);
    r.eng.dispose();
    for (const s of [...storage, ...consoleSpies]) expect(s).not.toHaveBeenCalled();
  });
});

describe('recipes used by the engine', () => {
  it('every sound id has a recipe, so play can never look anything else up', () => {
    const ids = Object.keys(RECIPES) as SoundId[];
    expect(ids).toHaveLength(7);
    for (const id of ids) expect(DURATION_MS[id]).toBeGreaterThan(0);
  });
});
