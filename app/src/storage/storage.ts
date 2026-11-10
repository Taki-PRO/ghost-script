import type { AttemptRecord, Outcome, ReviewEntry, ReviewHistory } from '../engine/scheduler';

/**
 * Wrapped localStorage (Req 7). The whole app state lives in ONE blob under
 * a single key; nothing outside this module touches localStorage keys.
 * No exported function ever throws: every storage access (including merely
 * touching `window.localStorage`, which can throw in private mode) is wrapped
 * in try/catch and degrades to in-memory defaults.
 */

/** Schema version written by this build. */
export const CURRENT_SCHEMA_VERSION = 1;

/** The single localStorage key holding the persisted blob. */
export const STORAGE_KEY = 'ghost-script:state';

/** The persisted blob. Req 7.1, 7.2. */
export interface PersistedState {
  readonly schemaVersion: number;
  readonly introSeen: boolean;
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
  recordOutcome(char: string, entry: ReviewEntry, now: number): PersistedState;
  getIntroSeen(): boolean;
  setIntroSeen(seen: boolean): void;
  resetToDefaults(): void;
}

/**
 * Migrations shipped with the app. EMPTY: schema version 1 is the first
 * version, so no older schema exists yet. Add `1: (old) => ...` etc. when
 * CURRENT_SCHEMA_VERSION is bumped.
 */
const SHIPPED_MIGRATIONS: MigrationMap = {};

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
  if (!isValidHistory(blob.history)) return undefined;
  return { schemaVersion: version, introSeen: blob.introSeen, history: blob.history };
}

/** Create a store. Used by tests (fake backend, versions, migrations). */
export function createStore(options: StoreOptions = {}): Store {
  const version = options.currentVersion ?? CURRENT_SCHEMA_VERSION;
  const migrations = options.migrations ?? SHIPPED_MIGRATIONS;
  const key = options.key ?? STORAGE_KEY;
  const backendOpt = options.backend;

  const defaultState: PersistedState = Object.freeze({
    schemaVersion: version,
    introSeen: false,
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
      if (!backend) return;
      const blob: PersistedState = {
        schemaVersion: version,
        introSeen: state.introSeen,
        history: state.history,
      };
      backend.setItem(key, JSON.stringify(blob));
    } catch {
      // quota exceeded / storage disabled: progress is simply not persisted
    }
  }

  /**
   * Persist one character's new entry immediately and return the new state
   * (returned even if the write failed, so the UI keeps working in memory).
   * `_now` is accepted for API parity with the design and is unused: the
   * caller has already computed `entry` with applyReview.
   */
  function recordOutcome(char: string, entry: ReviewEntry, _now: number): PersistedState {
    const prior = loadState();
    const next: PersistedState = {
      schemaVersion: version,
      introSeen: prior.introSeen,
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

  function resetToDefaults(): void {
    try {
      getBackend()?.removeItem(key);
    } catch {
      // ignore
    }
  }

  return { defaultState, loadState, saveState, recordOutcome, getIntroSeen, setIntroSeen, resetToDefaults };
}

const defaultStore = createStore();

/** Safe default used on first run, disabled storage, corruption, or reset. */
export const DEFAULT_STATE: PersistedState = defaultStore.defaultState;

export const loadState = (): PersistedState => defaultStore.loadState();
export const saveState = (state: PersistedState): void => defaultStore.saveState(state);
export const recordOutcome = (char: string, entry: ReviewEntry, now: number): PersistedState =>
  defaultStore.recordOutcome(char, entry, now);
export const getIntroSeen = (): boolean => defaultStore.getIntroSeen();
export const setIntroSeen = (seen: boolean): void => defaultStore.setIntroSeen(seen);
export const resetToDefaults = (): void => defaultStore.resetToDefaults();
