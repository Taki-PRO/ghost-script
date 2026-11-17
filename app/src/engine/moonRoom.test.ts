import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MOON_ROOM_BREAKPOINT_PX, MOON_ROOM_PX, moonRoomPx } from './moonRoom';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../styles/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('moonRoomPx', () => {
  it('is 76 below the breakpoint and 0 from it', () => {
    expect(moonRoomPx(320)).toBe(76);
    expect(moonRoomPx(991)).toBe(76);
    expect(moonRoomPx(992)).toBe(0);
    expect(moonRoomPx(1440)).toBe(0);
  });

  it('equals the --moon-room of index.css', () => {
    const m = css.match(/--moon-room:\s*clamp\(0px, calc\(\((\d+)px - 100vw\) \* \d+\), ([\d.]+)rem\)/);
    expect(m).not.toBeNull();
    expect(MOON_ROOM_BREAKPOINT_PX).toBe(Number(m![1]));
    expect(MOON_ROOM_PX / 16).toBe(Number(m![2]));
  });
});
