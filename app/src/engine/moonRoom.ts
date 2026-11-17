/** Height in CSS pixels of the room left under the moon: 4.75 rem, `--moon-room` in index.css. */
export const MOON_ROOM_PX = 76;

/** Width in CSS pixels from which the room is 0: the 992px in the `--moon-room` clamp(). */
export const MOON_ROOM_BREAKPOINT_PX = 992;

/** Room at the top of every screen for a viewport of the given width. */
export function moonRoomPx(width: number): number {
  return width < MOON_ROOM_BREAKPOINT_PX ? MOON_ROOM_PX : 0;
}
