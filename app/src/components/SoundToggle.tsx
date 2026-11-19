// The Sound_Toggle: a paper slip with a speaker icon, fixed beside the Moon (see .sound-toggle in index.css).
// The state is carried by shape (waves against a slash) and by aria-pressed, never by colour alone.
import { useSound } from '../audio/SoundProvider';

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const SPEAKER = 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z';
const WAVES = 'M15.2 9.3a3.8 3.8 0 0 1 0 5.4M17.8 6.8a7.4 7.4 0 0 1 0 10.4';
const SLASH = 'M4 4l16 16';

export function SoundToggle(): JSX.Element | null {
  const { available, soundOn, setSoundOn } = useSound();
  if (!available) return null;
  return (
    <button
      type="button"
      data-testid="sound-toggle"
      aria-label="Sound"
      aria-pressed={soundOn}
      onClick={() => setSoundOn(!soundOn)}
      className={`slip sound-toggle h-11 w-11 p-0 ${focusRing}`}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        data-icon={soundOn ? 'on' : 'off'}
      >
        <path d={SPEAKER} fill="currentColor" />
        {soundOn ? (
          <path d={WAVES} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path d={SLASH} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
