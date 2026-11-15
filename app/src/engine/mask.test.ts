import { describe, expect, it } from 'vitest';
import { maskTarget } from './mask';

describe('maskTarget', () => {
  it('returns the text unchanged when the character does not occur', () => {
    expect(maskTarget('a question particle', '么')).toBe('a question particle');
  });

  it('replaces every occurrence with the full-width tilde', () => {
    expect(maskTarget('什么 and 么 again 么', '么')).toBe('什～ and ～ again ～');
  });

  it('returns an empty string for empty text', () => {
    expect(maskTarget('', '么')).toBe('');
  });

  it('handles characters outside the BMP (surrogate pairs) as whole characters', () => {
    const rare = '\u{20BB7}';
    expect(maskTarget(`x${rare}y${rare}`, rare)).toBe('x～y～');
    // A different astral character sharing the high surrogate is not a match.
    expect(maskTarget('\u{20BB6}', rare)).toBe('\u{20BB6}');
  });
});
