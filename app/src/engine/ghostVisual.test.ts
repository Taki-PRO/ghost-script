import { describe, expect, it } from 'vitest';
import { ghostStateFor } from './ghostVisual';

describe('ghostStateFor', () => {
  it('maps null to haunting', () => {
    expect(ghostStateFor(null)).toBe('haunting');
  });
  it('maps clean to faded', () => {
    expect(ghostStateFor('clean')).toBe('faded');
  });
  it('maps struggled to flickering', () => {
    expect(ghostStateFor('struggled')).toBe('flickering');
  });
  it('maps gave-up to drifted', () => {
    expect(ghostStateFor('gave-up')).toBe('drifted');
  });
  it('takes only the outcome', () => {
    expect(ghostStateFor.length).toBe(1);
  });
});
