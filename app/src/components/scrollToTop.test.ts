import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollToTop } from './scrollToTop';

describe('scrollToTop', () => {
  const original = window.scrollTo;

  afterEach(() => {
    window.scrollTo = original;
  });

  it('calls window.scrollTo once with (0, 0) and no options', () => {
    const spy = vi.fn();
    window.scrollTo = spy as unknown as typeof window.scrollTo;
    scrollToTop();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual([0, 0]);
  });

  it('does nothing and does not throw when window.scrollTo is undefined', () => {
    (window as unknown as { scrollTo: unknown }).scrollTo = undefined;
    expect(() => scrollToTop()).not.toThrow();
  });
});
