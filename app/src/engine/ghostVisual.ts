import type { Outcome } from './scheduler';

export type GhostState = 'haunting' | 'faded' | 'flickering' | 'drifted';

/**
 * Maps a ghost's Outcome to its visual state. Takes only the Outcome, so no
 * animation can depend on which character the ghost is (Req 4.7).
 * null -> haunting, clean -> faded, struggled -> flickering, gave-up -> drifted.
 */
export function ghostStateFor(outcome: Outcome | null): GhostState {
  switch (outcome) {
    case 'clean':
      return 'faded';
    case 'struggled':
      return 'flickering';
    case 'gave-up':
      return 'drifted';
    default:
      return 'haunting';
  }
}
