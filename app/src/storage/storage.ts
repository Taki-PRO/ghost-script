import type { Level } from '../data/types';
import type { AttemptRecord, Outcome, ReviewEntry, ReviewHistory } from '../engine/scheduler';

/**
 * Wrapped localStorage (Req 7). The whole app state lives in ONE blob under
 * a single key; nothing outside this module touches localStorage keys.
 * No exported function ever throws: every storage access (including merely
 * touching `window.localStorage`, which can throw in private mode) is wrapped
 * in try/catch and degrades to in-memory defaults.
 */

/** Schema version written by this build. */
export const CURRENT_SCHEMA_VERSION = 4;

/** The single localStorage key holding the persisted blob. */
export const STORAGE_KEY = 'ghost-script:state';


function isLevel(v: unknown): v is Level {
  return v === 1 || v === 2 || v === 3;
}

/** The persisted blob. Req 7.1, 7.2. */
export interface PersistedState {
  readonly schemaVersion: number;
  readonly introSeen: boolean;
  /** Whether the player has read "How Cangjie works". Added in schema 2. */
  readonly cangjieIntroSeen: boolean;
  /** The starting level. Added in schema 3. */
  readonly level: Level;
  /** True once the player has chosen a level (or had a save before levels existed). Added in schema 3. */
  readonly levelChosen: boolean;
  /** Whether sound effects are on. Added in schema 4; default true. */
  readonly soundOn: boolean;
  /** Whether the night wind is on. Added in schema 4; default false. */
  readonly ambienceOn: boolean;
  readonly history: ReviewHistory;
}

/** Minimal subset of the Web Storage API used by this module. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `migrations[v]` migrates a blob FROM version v TO version v + 1. */
export type MigrationMap = Readonly<Record<number, (old: unknown) => unknown>>;

export interface StoreOptions {
  /** A storage object, or a (possibly throwing) lazy resolver for one. */
  readonly backend?: StorageLike | (() => StorageLike | undefined);
  readonly currentVersion?: number;
  readonly migrations?: MigrationMap;
  readonly key?: string;
}

export interface Store {
  /** Safe default for this store's current version. */
  readonly defaultState: PersistedState;
  loadState(): PersistedState;
  saveState(state: PersistedState): void;
  recordOutcome(char: string, entry: ReviewEntry): PersistedState;
  getIntroSeen(): boolean;
  setIntroSeen(seen: boolean): void;
  getCangjieIntroSeen(): boolean;
  setCangjieIntroSeen(seen: boolean): void;
  getLevel(): Level;
  getLevelChosen(): boolean;
  /** Sets the level and marks it as chosen; leaves everything else as it is. */
  setLevel(level: Level): void;
  getSoundOn(): boolean;
  setSoundOn(on: boolean): void;
  getAmbienceOn(): boolean;
  setAmbienceOn(on: boolean): void;
  resetToDefaults(): void;
  /** False once any write has failed or had no backend during this page session; never reverts. */
  isSavingWorking(): boolean;
}

/**
 * Migrations shipped with the app. `2` migrates a version-2 blob to version 3
 * (level 1; levelChosen is true when the intro was already seen). `3` migrates
 * a version-3 blob to version 4: it keeps every field and sets soundOn to true
 * and ambienceOn to false, overwriting any value in the old blob. There is no
 * `1`: a version-1 blob has no migration path and resets to defaults. Add
 * `4: (old) => ...` etc. when CURRENT_SCHEMA_VERSION is bumped again.
 */
const SHIPPED_MIGRATIONS: MigrationMap = {
  2: (old) => {
    const b = old as Record<string, unknown>;
    return { ...b, level: 1, levelChosen: b.introSeen === true };
  },
  3: (old) => {
    const b = old as Record<string, unknown>;
    return { ...b, soundOn: true, ambienceOn: false };
  },
};

const OUTCOMES: readonly string[] = ['clean', 'struggled', 'gave-up'];

/**
 * Keys that could pollute prototypes. A history containing any of them is
 * treated as corrupt and the whole blob is reset (never repaired).
 */
const FORBIDDEN_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function isOutcome(v: unknown): v is Outcome {
  return typeof v === 'string' && OUTCOMES.includes(v);
}

function isAttempt(v: unknown): v is AttemptRecord {
  return isPlainObject(v) && isOutcome(v.outcome) && typeof v.at === 'number' && Number.isFinite(v.at);
}

function isReviewEntry(v: unknown): v is ReviewEntry {
  if (!isPlainObject(v)) return false;
  const { step, lastOutcome, nextDue, history } = v;
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0) return false;
  if (!isOutcome(lastOutcome)) return false;
  if (typeof nextDue !== 'number' || !Number.isFinite(nextDue) || nextDue < 0) return false;
  if (history !== undefined && !(Array.isArray(history) && history.every(isAttempt))) return false;
  return true;
}

function isValidHistory(v: unknown): v is ReviewHistory {
  if (!isPlainObject(v)) return false;
  for (const k of Object.keys(v)) {
    if (FORBIDDEN_KEYS.includes(k)) return false;
    if (!isReviewEntry(v[k])) return false;
  }
  return true;
}

/** Validate a blob already at `version`; returns it or undefined. */
function validateState(blob: unknown, version: number): PersistedState | undefined {
  if (!isPlainObject(blob)) return undefined;
  if (blob.schemaVersion !== version) return undefined;
  if (typeof blob.introSeen !== 'boolean') return undefined;
  if (typeof blob.cangjieIntroSeen !== 'boolean') return undefined;
  if (!isLevel(blob.level)) return undefined;
  if (typeof blob.levelChosen !== 'boolean') return undefined;
  if (!isValidHistory(blob.history)) return undefined;
  return {
    schemaVersion: version,
    introSeen: blob.introSeen,
    cangjieIntroSeen: blob.cangjieIntroSeen,
    level: blob.level,
    levelChosen: blob.levelChosen,
    // A bad sound field is repaired on its own and never drops the history.
    soundOn: typeof blob.soundOn === 'boolean' ? blob.soundOn : true,
    ambienceOn: typeof blob.ambienceOn === 'boolean' ? blob.ambienceOn : false,
    history: blob.history,
  };
}

/** Create a store. Used by tests (fake backend, versions, migrations). */
export function createStore(options: StoreOptions = {}): Store {
  const version = options.currentVersion ?? CURRENT_SCHEMA_VERSION;
  const migrations = options.migrations ?? SHIPPED_MIGRATIONS;
  const key = options.key ?? STORAGE_KEY;
  const backendOpt = options.backend;
  let saveFailedThisSession = false; // sticky: set by any failed write, never cleared

  const defaultState: PersistedState = Object.freeze({
    schemaVersion: version,
    introSeen: false,
    cangjieIntroSeen: false,
    level: 1,
    levelChosen: false,
    soundOn: true,
    ambienceOn: false,
    history: Object.freeze({}) as ReviewHistory,
  });

  /** Resolve the backend lazily; any failure -> undefined. */
  function getBackend(): StorageLike | undefined {
    try {
      if (backendOpt === undefined) {
        return typeof window === 'undefined' ? undefined : window.localStorage;
      }
      return typeof backendOpt === 'function' ? backendOpt() : backendOpt;
    } catch {
      return undefined;
    }
  }

  function loadState(): PersistedState {
    try {
      const backend = getBackend();
      if (!backend) return defaultState;
      const raw = backend.getItem(key);
      if (raw === null) return defaultState;

      let blob: unknown = JSON.parse(raw);
      if (!isPlainObject(blob)) return defaultState;
      const stored = blob.schemaVersion;
      if (typeof stored !== 'number' || !Number.isInteger(stored) || stored < 1) return defaultState;
      if (stored > version) return defaultState; // newer: never migrate forward

      for (let v = stored; v < version; v++) {
        const migrate = migrations[v];
        if (typeof migrate !== 'function') return defaultState; // no path: reset
        const next = migrate(blob);
        if (!isPlainObject(next)) return defaultState;
        blob = { ...next, schemaVersion: v + 1 };
      }
      return validateState(blob, version) ?? defaultState;
    } catch {
      return defaultState;
    }
  }

  function saveState(state: PersistedState): void {
    try {
      const backend = getBackend();
      if (!backend) {
        saveFailedThisSession = true;
        return;
      }
      const blob: PersistedState = {
        schemaVersion: version,
        introSeen: state.introSeen,
        cangjieIntroSeen: state.cangjieIntroSeen,
        level: state.level,
        levelChosen: state.levelChosen,
        soundOn: state.soundOn,
        ambienceOn: state.ambienceOn,
        history: state.history,
      };
      backend.setItem(key, JSON.stringify(blob));
    } catch {
      saveFailedThisSession = true;
      // quota exceeded / storage disabled: progress is simply not persisted
    }
  }

  /**
   * Persist one character's new entry immediately and return the new state
   * (returned even if the write failed, so the UI keeps working in memory).
   * The caller computes `entry` with applyReview using the UI-injected clock,
   * so no time argument is needed here.
   */
  function recordOutcome(char: string, entry: ReviewEntry): PersistedState {
    const prior = loadState();
    const next: PersistedState = {
      schemaVersion: version,
      introSeen: prior.introSeen,
      cangjieIntroSeen: prior.cangjieIntroSeen,
      level: prior.level,
      levelChosen: prior.levelChosen,
      soundOn: prior.soundOn,
      ambienceOn: prior.ambienceOn,
      history: { ...prior.history, [char]: entry },
    };
    saveState(next);
    return next;
  }

  function getIntroSeen(): boolean {
    return loadState().introSeen;
  }

  function setIntroSeen(seen: boolean): void {
    const prior = loadState();
    saveState({ ...prior, introSeen: seen });
  }

  function getCangjieIntroSeen(): boolean {
    return loadState().cangjieIntroSeen;
  }

  function setCangjieIntroSeen(seen: boolean): void {
    const prior = loadState();
    saveState({ ...prior, cangjieIntroSeen: seen });
  }

  function getLevel(): Level {
    return loadState().level;
  }

  function getLevelChosen(): boolean {
    return loadState().levelChosen;
  }

  function setLevel(level: Level): void {
    const prior = loadState();
    saveState({ ...prior, level, levelChosen: true });
  }

  function getSoundOn(): boolean {
    return loadState().soundOn;
  }

  function setSoundOn(on: boolean): void {
    saveState({ ...loadState(), soundOn: on });
  }

  function getAmbienceOn(): boolean {
    return loadState().ambienceOn;
  }

  function setAmbienceOn(on: boolean): void {
    saveState({ ...loadState(), ambienceOn: on });
  }

  function resetToDefaults(): void {
    try {
      getBackend()?.removeItem(key);
    } catch {
      // ignore
    }
  }

  function isSavingWorking(): boolean {
    return !saveFailedThisSession;
  }

  return { defaultState, loadState, saveState, recordOutcome, getIntroSeen,
    setIntroSeen,
    getCangjieIntroSeen,
    setCangjieIntroSeen,
    getLevel,
    getLevelChosen,
    setLevel,
    getSoundOn,
    setSoundOn,
    getAmbienceOn,
    setAmbienceOn,
    resetToDefaults,
    isSavingWorking,
  };
}

const defaultStore = createStore();

/** Safe default used on first run, disabled storage, corruption, or reset. */
export const DEFAULT_STATE: PersistedState = defaultStore.defaultState;

export const loadState = (): PersistedState => defaultStore.loadState();
export const saveState = (state: PersistedState): void => defaultStore.saveState(state);
export const recordOutcome = (char: string, entry: ReviewEntry): PersistedState =>
  defaultStore.recordOutcome(char, entry);
export const getIntroSeen = (): boolean => defaultStore.getIntroSeen();
export const setIntroSeen = (seen: boolean): void => defaultStore.setIntroSeen(seen);
export const getCangjieIntroSeen = (): boolean => defaultStore.getCangjieIntroSeen();
export const setCangjieIntroSeen = (seen: boolean): void => defaultStore.setCangjieIntroSeen(seen);
export const getLevel = (): Level => defaultStore.getLevel();
export const getLevelChosen = (): boolean => defaultStore.getLevelChosen();
export const setLevel = (level: Level): void => defaultStore.setLevel(level);
export const getSoundOn = (): boolean => defaultStore.getSoundOn();
export const setSoundOn = (on: boolean): void => defaultStore.setSoundOn(on);
export const getAmbienceOn = (): boolean => defaultStore.getAmbienceOn();
export const setAmbienceOn = (on: boolean): void => defaultStore.setAmbienceOn(on);
export const resetToDefaults = (): void => defaultStore.resetToDefaults();
export const isSavingWorking = (): boolean => defaultStore.isSavingWorking();
