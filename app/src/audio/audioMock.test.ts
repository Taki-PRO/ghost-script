import { afterEach, describe, expect, it } from 'vitest';
import { createMock, installAudioMock, type MockAudioContext, type MockHandle } from './audioMock';

let handle: MockHandle | undefined;
afterEach(() => {
  handle?.restore();
  handle = undefined;
});

describe('audioMock', () => {
  it('records constructions and installs both global names', () => {
    handle = installAudioMock();
    const g = globalThis as unknown as Record<string, new () => MockAudioContext>;
    new g.AudioContext();
    new g.webkitAudioContext();
    expect(handle.log.constructions).toBe(2);
    expect(handle.log.contexts[0].state).toBe('suspended');
  });

  it("'webkit' leaves only webkitAudioContext and restore() removes it", () => {
    handle = installAudioMock({}, 'webkit');
    const g = globalThis as unknown as Record<string, unknown>;
    expect(g.AudioContext).toBeUndefined();
    expect(typeof g.webkitAudioContext).toBe('function');
    handle.restore();
    expect(g.webkitAudioContext).toBeUndefined();
  });

  it('a throwing constructor is counted and throws', () => {
    handle = createMock({ ctorThrows: new Error('no audio') });
    expect(() => handle?.create()).toThrow('no audio');
    expect(handle.log.constructions).toBe(1);
    expect(handle.log.contexts).toHaveLength(0);
  });

  it('resume resolves to running, rejects, or hangs; calls are counted', async () => {
    handle = createMock();
    const ctx = handle.create();
    await ctx.resume();
    expect(ctx.state).toBe('running');
    expect(handle.log.resumeCalls).toBe(1);

    const bad = createMock({ resume: 'reject' }).create();
    await expect(bad.resume()).rejects.toThrow();

    const hung = createMock({ resume: 'hang' }).create();
    let settled = false;
    void hung.resume().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(hung.state).toBe('suspended');
  });

  it('records parameter automation, connections, starts and stops', () => {
    handle = createMock();
    const ctx = handle.create();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.1, 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, 0.2);
    osc.start(0.5);
    osc.stop(0.9);
    expect(gain.gain.events.map((e) => e.method)).toEqual([
      'setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
    ]);
    expect(osc.connections).toEqual([gain]);
    expect(gain.connections).toEqual([ctx.destination]);
    expect(handle.log.sourceStarts.map((s) => s.when)).toEqual([0.5]);
    expect(handle.log.sourceStops.map((s) => s.when)).toEqual([0.9]);
  });

  it('throwOn makes the named node method throw', () => {
    const ctx = createMock({ throwOn: ['createGain', 'start'] }).create();
    expect(() => ctx.createGain()).toThrow();
    expect(() => ctx.createOscillator().start(0)).toThrow();
  });

  it('can start in interrupted or closed state', () => {
    expect(createMock({ initialState: 'interrupted' }).create().state).toBe('interrupted');
    expect(createMock({ initialState: 'closed' }).create().state).toBe('closed');
  });
});
