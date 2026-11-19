// Pure parts of the night-sounds end-to-end helpers (spec night-sounds, task 10.3).
// No Playwright import, so the unit tests can load this file.

/** One event of the Audio_Recorder; `t` is ms since the first user gesture, or null before it. */
export interface AudioEvent {
  readonly t: number | null;
}
export interface AudioStart extends AudioEvent {
  /** Constructor name of the source node, e.g. `OscillatorNode`. */
  readonly kind: string;
  readonly loop: boolean;
}
export interface AudioFailure extends AudioEvent {
  /** Which call failed: `construct`, `resume`, `createOscillator`, `createBufferSource` or `start`. */
  readonly what: string;
  readonly message: string;
}
/** What `window.__audio` holds after `installAudioRecorder`. */
export interface AudioLog {
  /** `performance.now()` of the first pointerdown, touchend, click or keydown; null until one happens. */
  firstGestureAt: number | null;
  constructed: number;
  constructions: AudioEvent[];
  resumes: number;
  resumeCalls: AudioEvent[];
  suspends: number;
  starts: AudioStart[];
  failures: AudioFailure[];
}

/** Starts of looping sources (the night wind). */
export function loopingStarts(log: Pick<AudioLog, 'starts'>): AudioStart[] {
  return log.starts.filter((s) => s.loop);
}

/** Events that happened before the first gesture (`t` is null); a correct app has none that build a context. */
export function beforeGesture<T extends AudioEvent>(events: readonly T[]): T[] {
  return events.filter((e) => e.t === null);
}

/** The persisted blob of schema 3 or 4 that the seed helpers write. */
export interface SoundSeedFields {
  readonly soundOn?: boolean;
  readonly ambienceOn?: boolean;
}

/**
 * The version a seed is written at: 4 when it carries a sound field or asks for 4, else 3.
 * Old seeds (no sound field) therefore stay at schema 3 and the app migrates them.
 */
export function seedSchemaVersion(requested: 3 | 4 | undefined, fields: SoundSeedFields): 3 | 4 {
  if (requested !== undefined) return requested;
  return fields.soundOn !== undefined || fields.ambienceOn !== undefined ? 4 : 3;
}
