// The Ambience_Toggle: a paper slip in page content that turns the night wind on or off.
// It uses aria-disabled (not disabled) while sound is off or reduced motion is requested,
// so it stays focusable and its note is reachable.
import { useSound } from '../audio/SoundProvider';

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function AmbienceToggle(): JSX.Element | null {
  const { available, soundOn, ambienceOn, reducedMotion, setAmbienceOn } = useSound();
  if (!available) return null;
  const disabled = !soundOn || reducedMotion;
  const note = !soundOn
    ? 'Turn sound on to hear the night wind.'
    : reducedMotion
      ? 'The night wind is off while reduced motion is requested.'
      : null;
  return (
    <>
      <button
        type="button"
        data-testid="ambience-toggle"
        aria-label="Night wind"
        aria-pressed={ambienceOn}
        aria-disabled={disabled ? 'true' : undefined}
        aria-describedby={note ? 'wind-note' : undefined}
        onClick={() => {
          if (disabled) return;
          setAmbienceOn(!ambienceOn);
        }}
        className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
      >
        {ambienceOn ? 'Night wind: on' : 'Night wind: off'}
      </button>
      {note ? (
        <p id="wind-note" className="text-center text-sm text-muted">
          {note}
        </p>
      ) : null}
    </>
  );
}
