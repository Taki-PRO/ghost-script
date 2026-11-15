import type { EngineConfig } from './config';
import type { Outcome } from './scheduler';

/** Req 5.5 / 5.6: clean iff no hint was shown AND mistakes <= clean threshold. */
export function resolveCompletion(
  hintShown: boolean,
  mistakes: number,
  config: Pick<EngineConfig, 'cleanMistakeThreshold'>,
): Outcome {
  return !hintShown && mistakes <= config.cleanMistakeThreshold ? 'clean' : 'struggled';
}

/**
 * The ghost's single Outcome. `summon` is null when the ghost has no Summon step.
 * gave-up if either step gave up; else struggled if either struggled; else clean.
 */
export function combineOutcomes(summon: Outcome | null, write: Outcome): Outcome {
  if (summon === 'gave-up' || write === 'gave-up') return 'gave-up';
  if (summon === 'struggled' || write === 'struggled') return 'struggled';
  return 'clean';
}
