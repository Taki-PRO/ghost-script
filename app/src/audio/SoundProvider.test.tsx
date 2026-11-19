import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAmbienceOn, getSoundOn, resetToDefaults, setAmbienceOn, setSoundOn } from '../storage/storage';
import { installAudioMock, type MockHandle } from './audioMock';
import { createSoundEngine, type SoundEngine } from './engine';
import { SoundProvider, useSound, type SoundApi } from './SoundProvider';

let api: SoundApi;
function Probe() {
  api = useSound();
  return null;
}

interface FakeEngine extends SoundEngine {
  calls: string[];
}
function fakeEngine(): FakeEngine {
  const calls: string[] = [];
  return {
    calls,
    play: (id) => void calls.push(`play:${id}`),
    setEnabled: (on) => void calls.push(`enabled:${on}`),
    setAmbience: (w) => void calls.push(`ambience:${w}`),
    unlock: () => void calls.push('unlock'),
    suspend: () => void calls.push('suspend'),
    dispose: () => void calls.push('dispose'),
  };
}

let mock: MockHandle | undefined;

beforeEach(() => {
  localStorage.clear();
  resetToDefaults();
  mock = installAudioMock();
});
afterEach(() => {
  cleanup();
  mock?.restore();
  mock = undefined;
  vi.restoreAllMocks();
});

describe('useSound outside a provider', () => {
  it('is a silent no-op API that is not available', () => {
    render(<Probe />);
    expect(api.available).toBe(false);
    expect(api.soundOn).toBe(false);
    expect(api.ambienceOn).toBe(false);
    expect(api.reducedMotion).toBe(false);
    expect(() => {
      api.play('key-tap');
      api.setSoundOn(true);
      api.setAmbienceOn(true);
      api.setAmbientScreen(true);
    }).not.toThrow();
    expect(getSoundOn()).toBe(true);
    expect(getAmbienceOn()).toBe(false);
    expect(mock?.log.constructions).toBe(0);
  });
});

describe('SoundProvider', () => {
  it('reads the saved flags from storage', () => {
    setSoundOn(false);
    setAmbienceOn(true);
    render(<SoundProvider createEngine={fakeEngine}><Probe /></SoundProvider>);
    expect(api.available).toBe(true);
    expect(api.soundOn).toBe(false);
    expect(api.ambienceOn).toBe(true);
  });

  it('defaults to sound on and wind off', () => {
    render(<SoundProvider createEngine={fakeEngine}><Probe /></SoundProvider>);
    expect(api.soundOn).toBe(true);
    expect(api.ambienceOn).toBe(false);
  });

  it('disables the engine at start when the saved sound is off', () => {
    setSoundOn(false);
    const e = fakeEngine();
    render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    expect(e.calls).toContain('enabled:false');
  });

  it('setSoundOn(true) saves, enables, unlocks and plays one key-tap', () => {
    setSoundOn(false);
    const e = fakeEngine();
    render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    e.calls.length = 0;
    act(() => api.setSoundOn(true));
    expect(getSoundOn()).toBe(true);
    expect(api.soundOn).toBe(true);
    expect(e.calls).toEqual(['enabled:true', 'unlock', 'play:key-tap']);
  });

  it('setSoundOn(false) saves and calls setEnabled(false) without a tap', () => {
    const e = fakeEngine();
    render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    e.calls.length = 0;
    act(() => api.setSoundOn(false));
    expect(getSoundOn()).toBe(false);
    expect(api.soundOn).toBe(false);
    expect(e.calls).toEqual(['enabled:false']);
  });

  it('setAmbienceOn saves and the engine hears ambience only on an ambient screen', () => {
    const e = fakeEngine();
    render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    act(() => api.setAmbienceOn(true));
    expect(getAmbienceOn()).toBe(true);
    expect(e.calls.filter((c) => c.startsWith('ambience:')).pop()).toBe('ambience:false');
    act(() => api.setAmbientScreen(true));
    expect(e.calls.filter((c) => c.startsWith('ambience:')).pop()).toBe('ambience:true');
    act(() => api.setAmbientScreen(false));
    expect(e.calls.filter((c) => c.startsWith('ambience:')).pop()).toBe('ambience:false');
    act(() => api.setAmbientScreen(true));
    act(() => api.setAmbienceOn(false));
    expect(getAmbienceOn()).toBe(false);
    expect(e.calls.filter((c) => c.startsWith('ambience:')).pop()).toBe('ambience:false');
  });

  it('play reaches the engine and keeps one identity across renders', () => {
    const e = fakeEngine();
    render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    const first = api.play;
    act(() => api.setSoundOn(false));
    act(() => api.setAmbienceOn(true));
    expect(api.play).toBe(first);
    api.play('seal-thud');
    expect(e.calls).toContain('play:seal-thud');
  });

  it('play never throws when the engine throws', () => {
    const e = { ...fakeEngine(), play: () => { throw new Error('boom'); } };
    render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    expect(() => api.play('key-tap')).not.toThrow();
  });

  it('keeps the in-memory choice when saving fails', () => {
    const e = fakeEngine();
    render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    act(() => api.setSoundOn(false));
    expect(api.soundOn).toBe(false);
    act(() => api.setAmbienceOn(true));
    expect(api.ambienceOn).toBe(true);
    expect(e.calls).toContain('enabled:false');
  });

  it('builds no AudioContext before a gesture, then one on the first gesture', () => {
    render(<SoundProvider><Probe /></SoundProvider>);
    expect(mock?.log.constructions).toBe(0);
    act(() => api.play('key-tap'));
    expect(mock?.log.constructions).toBe(0);
    act(() => {
      document.dispatchEvent(new Event('click'));
    });
    expect(mock?.log.constructions).toBe(1);
  });

  it('turning sound on inside a gesture builds the context in that call', () => {
    setSoundOn(false);
    render(<SoundProvider><Probe /></SoundProvider>);
    act(() => api.setSoundOn(true));
    expect(mock?.log.constructions).toBe(1);
  });

  it('reports reducedMotion from matchMedia and follows its change event', () => {
    let matches = true;
    let listener: (() => void) | undefined;
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return matches; },
      addEventListener: (_: string, l: () => void) => { listener = l; },
      removeEventListener: () => { listener = undefined; },
    }));
    try {
      render(<SoundProvider createEngine={fakeEngine}><Probe /></SoundProvider>);
      expect(api.reducedMotion).toBe(true);
      matches = false;
      act(() => listener?.());
      expect(api.reducedMotion).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('builds the engine once under StrictMode and disposes the first', () => {
    const made: FakeEngine[] = [];
    render(
      <StrictMode>
        <SoundProvider createEngine={() => { const e = fakeEngine(); made.push(e); return e; }}>
          <Probe />
        </SoundProvider>
      </StrictMode>,
    );
    expect(made).toHaveLength(2);
    expect(made[0].calls).toContain('dispose');
    expect(made[1].calls).not.toContain('dispose');
    act(() => api.setSoundOn(false));
    expect(made[0].calls).not.toContain('enabled:false');
    expect(made[1].calls).toContain('enabled:false');
  });

  it('disposes the engine on unmount', () => {
    const e = fakeEngine();
    const { unmount } = render(<SoundProvider createEngine={() => e}><Probe /></SoundProvider>);
    unmount();
    expect(e.calls.filter((c) => c === 'dispose')).toHaveLength(1);
  });

  it('removes the real engine gesture listeners on unmount', () => {
    const spy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<SoundProvider createEngine={() => createSoundEngine()}><Probe /></SoundProvider>);
    unmount();
    const removed = spy.mock.calls.map((c) => c[0]);
    for (const t of ['pointerdown', 'touchend', 'click', 'keydown', 'visibilitychange']) {
      expect(removed).toContain(t);
    }
  });
});

describe('SoundProvider without Web Audio', () => {
  beforeEach(() => {
    mock?.restore();
    mock = undefined;
    const g = globalThis as { AudioContext?: unknown; webkitAudioContext?: unknown };
    delete g.AudioContext;
    delete g.webkitAudioContext;
  });

  it('is unavailable, creates no engine and play is a no-op', () => {
    const createEngine = vi.fn(fakeEngine);
    render(<SoundProvider createEngine={createEngine}><Probe /></SoundProvider>);
    expect(api.available).toBe(false);
    expect(createEngine).not.toHaveBeenCalled();
    expect(() => {
      api.play('key-tap');
      api.setSoundOn(false);
      api.setAmbienceOn(true);
    }).not.toThrow();
    expect(getSoundOn()).toBe(false);
    expect(getAmbienceOn()).toBe(true);
  });
});
