import { describe, expect, it } from 'vitest';
import { beforeGesture, loopingStarts, seedSchemaVersion } from '../../e2e/audioLog';

describe('e2e audio log helpers', () => {
  it('seeds stay at schema 3 unless a sound field or version 4 is asked for', () => {
    expect(seedSchemaVersion(undefined, {})).toBe(3);
    expect(seedSchemaVersion(undefined, { soundOn: false })).toBe(4);
    expect(seedSchemaVersion(undefined, { ambienceOn: true })).toBe(4);
    expect(seedSchemaVersion(4, {})).toBe(4);
    expect(seedSchemaVersion(3, {})).toBe(3);
  });

  it('picks looping starts and events before the first gesture', () => {
    const starts = [
      { t: 5, kind: 'OscillatorNode', loop: false },
      { t: 9, kind: 'AudioBufferSourceNode', loop: true },
    ];
    expect(loopingStarts({ starts })).toEqual([starts[1]]);
    expect(beforeGesture([{ t: null }, { t: 3 }])).toEqual([{ t: null }]);
  });
});
