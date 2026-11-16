/**
 * Jumps to the top of the page. Instant in every motion setting: no
 * `behavior` option is passed.
 */
export function scrollToTop(): void {
  if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') return;
  window.scrollTo(0, 0);
}
