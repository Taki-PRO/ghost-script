import { describe, expect, it } from 'vitest';
import {
  SEAL_CLEARANCE_PX,
  SEAL_GLYPH_PX,
  SEAL_INSET_PX,
  SEAL_SIZE_PX,
  WRITE_PADDING_PX,
} from './sealLayout';

describe('sealLayout', () => {
  it('has the approved values', () => {
    expect(WRITE_PADDING_PX).toBe(40);
    expect(SEAL_SIZE_PX).toBe(32);
    expect(SEAL_INSET_PX).toBe(4);
    expect(SEAL_GLYPH_PX).toBe(24);
  });
  it('keeps at least 4 px between the seal and the drawing area', () => {
    expect(SEAL_CLEARANCE_PX).toBe(WRITE_PADDING_PX - (SEAL_SIZE_PX + SEAL_INSET_PX));
    expect(SEAL_CLEARANCE_PX).toBeGreaterThanOrEqual(4);
  });
});
