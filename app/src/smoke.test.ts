import { describe, expect, it } from 'vitest';

describe('app project smoke test', () => {
  it('runs under jsdom', () => {
    expect(true).toBe(true);
    expect(typeof document).toBe('object');
  });
});
