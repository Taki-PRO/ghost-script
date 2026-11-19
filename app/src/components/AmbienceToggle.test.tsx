import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundApiContext, type SoundApi } from '../audio/SoundProvider';
import { AmbienceToggle } from './AmbienceToggle';

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
      <AmbienceToggle />
    </SoundApiContext.Provider>,
  );
}

describe('AmbienceToggle', () => {
  it('is named "Night wind" with aria-pressed and visible on/off text', () => {
    const { unmount } = renderToggle(api({ ambienceOn: false }));
    let button = screen.getByRole('button', { name: 'Night wind' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('Night wind: off');
    unmount();
    renderToggle(api({ ambienceOn: true }));
    button = screen.getByRole('button', { name: 'Night wind' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('Night wind: on');
  });

  it('is a 44 px paper slip, not a primary action, with no note when enabled', () => {
    renderToggle(api());
    const button = screen.getByTestId('ambience-toggle');
    expect(button).toHaveClass('slip');
    expect(button).toHaveClass('min-h-[44px]');
    expect(button).not.toHaveClass('slip-primary');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('wind-note')).toBeNull();
  });

  it('flips through setAmbienceOn when enabled', () => {
    const value = api({ ambienceOn: false });
    renderToggle(value);
    fireEvent.click(screen.getByTestId('ambience-toggle'));
    expect(value.setAmbienceOn).toHaveBeenCalledWith(true);
  });

  it('is aria-disabled with a note while sound is off, and does not flip', () => {
    const value = api({ soundOn: false });
    renderToggle(value);
    const button = screen.getByTestId('ambience-toggle');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-describedby', 'wind-note');
    expect(screen.getByText('Turn sound on to hear the night wind.')).toHaveAttribute('id', 'wind-note');
    fireEvent.click(button);
    expect(value.setAmbienceOn).not.toHaveBeenCalled();
  });

  it('is aria-disabled with the reduced-motion note, and does not flip', () => {
    const value = api({ reducedMotion: true });
    renderToggle(value);
    const button = screen.getByTestId('ambience-toggle');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('The night wind is off while reduced motion is requested.')).toHaveAttribute('id', 'wind-note');
    fireEvent.click(button);
    expect(value.setAmbienceOn).not.toHaveBeenCalled();
  });

  it('renders nothing when Web Audio is unavailable', () => {
    renderToggle(api({ available: false }));
    expect(screen.queryByTestId('ambience-toggle')).toBeNull();
  });
});
