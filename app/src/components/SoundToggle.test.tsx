import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundApiContext, type SoundApi } from '../audio/SoundProvider';
import { SoundToggle } from './SoundToggle';

function api(over: Partial<SoundApi> = {}): SoundApi {
  return {
    available: true,
    soundOn: true,
    ambienceOn: false,
    reducedMotion: false,
    play: vi.fn(),
    setSoundOn: vi.fn(),
    setAmbienceOn: vi.fn(),
    setAmbientScreen: vi.fn(),
    ...over,
  };
}

afterEach(() => cleanup());

function renderToggle(value: SoundApi) {
  return render(
    <SoundApiContext.Provider value={value}>
      <SoundToggle />
    </SoundApiContext.Provider>,
  );
}

describe('SoundToggle', () => {
  it('has the fixed name "Sound" and aria-pressed for both states', () => {
    const { unmount } = renderToggle(api({ soundOn: true }));
    expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'true');
    unmount();
    renderToggle(api({ soundOn: false }));
    expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('is a 44 px paper slip and never a primary action', () => {
    renderToggle(api());
    const button = screen.getByTestId('sound-toggle');
    expect(button).toHaveAttribute('type', 'button');
    for (const c of ['slip', 'sound-toggle', 'h-11', 'w-11', 'p-0']) expect(button).toHaveClass(c);
    expect(button).not.toHaveClass('slip-primary');
    expect(button.className).toContain('focus-visible:ring-2');
  });

  it('draws an aria-hidden icon from paths, with waves when on and a slash when off', () => {
    const { unmount } = renderToggle(api({ soundOn: true }));
    const on = screen.getByTestId('sound-toggle').querySelector('svg')!;
    expect(on).toHaveAttribute('aria-hidden', 'true');
    expect(on.querySelector('text')).toBeNull();
    const onPaths = [...on.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    unmount();
    renderToggle(api({ soundOn: false }));
    const off = screen.getByTestId('sound-toggle').querySelector('svg')!;
    expect(off).toHaveAttribute('aria-hidden', 'true');
    expect(off.querySelector('text')).toBeNull();
    const offPaths = [...off.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    expect(onPaths).toHaveLength(2);
    expect(offPaths).toHaveLength(2);
    expect(onPaths[0]).toBe(offPaths[0]);
    expect(onPaths[1]).not.toBe(offPaths[1]);
  });

  it('calls setSoundOn with the opposite value on click, Enter and Space, and keeps focus', async () => {
    const value = api({ soundOn: true });
    renderToggle(value);
    const button = screen.getByTestId('sound-toggle');
    const user = userEvent.setup();
    await user.click(button);
    expect(value.setSoundOn).toHaveBeenLastCalledWith(false);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(value.setSoundOn).toHaveBeenCalledTimes(3);
    expect(document.activeElement).toBe(button);
  });

  it('turns sound on from off', () => {
    const value = api({ soundOn: false });
    renderToggle(value);
    fireEvent.click(screen.getByTestId('sound-toggle'));
    expect(value.setSoundOn).toHaveBeenCalledWith(true);
  });

  it('renders nothing when Web Audio is unavailable', () => {
    renderToggle(api({ available: false }));
    expect(screen.queryByTestId('sound-toggle')).toBeNull();
  });
});
