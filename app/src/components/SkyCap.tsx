/**
 * Sky_Cap: a decorative fixed layer that repaints the sky over the Moon_Room
 * below 992 px (rules in styles/index.css). No props, hidden from assistive
 * technology, never focusable.
 */
export function SkyCap() {
  return <div className="sky-cap" aria-hidden="true" data-testid="sky-cap" />;
}
