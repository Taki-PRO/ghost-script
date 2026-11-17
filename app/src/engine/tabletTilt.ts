/** Fixed tilt pattern of the Graveyard tablets, in degrees, by position mod 5. */
export const TABLET_TILTS_DEG: readonly number[] = [-3, 1.5, 0, -1.5, 3];

/** Class index (0 to 4) of a 1-based tablet position. */
export function tabletTiltIndex(position: number): number {
  return position % TABLET_TILTS_DEG.length;
}

/** Tilt of the tablet at a 1-based position, in degrees. Deterministic. */
export function tabletTilt(position: number): number {
  return TABLET_TILTS_DEG[tabletTiltIndex(position)];
}
