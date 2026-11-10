import '@testing-library/jest-dom/vitest';

// --- Web Storage shim -------------------------------------------------------
// Node >= 22 ships its own experimental `localStorage` / `sessionStorage`
// globals. They shadow the jsdom ones that Vitest's jsdom environment would
// otherwise install, and without a backing file they are unusable (undefined or
// missing methods). Vitest exposes the JSDOM instance as the global `jsdom`, so
// when the current global is not a usable Storage we copy jsdom's real one over.
// On Node versions where the global is already jsdom's (e.g. Node 20) this is a
// no-op, and it silently does nothing if `jsdom` is unavailable.

interface StorageLike {
  getItem: (key: string) => string | null;
}

interface JsdomGlobal {
  window?: Record<string, unknown>;
}

function isUsableStorage(value: unknown): value is StorageLike {
  return typeof (value as StorageLike | undefined | null)?.getItem === 'function';
}

function installJsdomStorage(name: 'localStorage' | 'sessionStorage'): void {
  const root = globalThis as unknown as Record<string, unknown>;
  if (isUsableStorage(root[name])) return;

  const jsdom = root.jsdom as JsdomGlobal | undefined;
  const real = jsdom?.window?.[name];
  if (!isUsableStorage(real)) return;

  const targets: object[] = [globalThis];
  if (typeof window !== 'undefined' && (window as unknown) !== globalThis) {
    targets.push(window);
  }
  for (const target of targets) {
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: real,
    });
  }
}

installJsdomStorage('localStorage');
installJsdomStorage('sessionStorage');
