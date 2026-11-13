import { useCallback, useEffect, useState } from 'react';
import { loadDataset, type CharacterDataset } from './data/charDataLoader';
import type { CharacterRecord } from './data/types';
import { DEFAULT_CONFIG, type EngineConfig } from './engine/config';
import { learningOrder } from './engine/learningOrder';
import {
  applyReview,
  selectSession,
  type Outcome,
  type ReviewHistory,
} from './engine/scheduler';
import { getIntroSeen, loadState, recordOutcome, setIntroSeen } from './storage/storage';
import { IntroScreen } from './components/IntroScreen';
import { StartMenu } from './components/StartMenu';
import { SeanceSession } from './components/SeanceSession';
import { SessionSummary, type SessionResults } from './components/SessionSummary';

/**
 * Pure: pick tonight's ghosts. `selectSession` receives the Learning order
 * (stroke-count sorted), never the dataset's JSON key order (Req 6.12).
 */
export function buildSession(
  dataset: CharacterDataset,
  history: ReviewHistory,
  now: number,
  config: EngineConfig,
): CharacterRecord[] {
  const chars = selectSession(history, learningOrder(dataset), now, config);
  const records: CharacterRecord[] = [];
  for (const char of chars) {
    const record = dataset.get(char);
    if (record !== undefined) records.push(record);
  }
  return records;
}

/** Own-property lookup so keys like "constructor" never hit the prototype. */
function priorEntry(history: ReviewHistory, char: string) {
  return Object.prototype.hasOwnProperty.call(history, char) ? history[char] : undefined;
}

type View =
  | { screen: 'loading' }
  | { screen: 'error' }
  | { screen: 'intro'; dataset: CharacterDataset }
  | { screen: 'menu'; dataset: CharacterDataset }
  | { screen: 'seance'; dataset: CharacterDataset; ghosts: CharacterRecord[]; sessionId: number }
  | { screen: 'summary'; dataset: CharacterDataset; results: SessionResults };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-background text-ink px-4 py-6">
      <div className="w-full max-w-3xl flex flex-col items-center">{children}</div>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState<View>({ screen: 'loading' });
  const [sessionCounter, setSessionCounter] = useState(0);

  useEffect(() => {
    let active = true;
    void loadDataset().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setView({ screen: 'error' });
        return;
      }
      setView({
        screen: getIntroSeen() ? 'menu' : 'intro',
        dataset: result.dataset,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const startSeance = useCallback(
    (dataset: CharacterDataset) => {
      const now = Date.now();
      const ghosts = buildSession(dataset, loadState().history, now, DEFAULT_CONFIG);
      setSessionCounter((n) => n + 1);
      setView({ screen: 'seance', dataset, ghosts, sessionId: sessionCounter + 1 });
    },
    [sessionCounter],
  );

  const handleOutcome = useCallback((char: string, outcome: Outcome, now: number) => {
    const prior = priorEntry(loadState().history, char);
    recordOutcome(char, applyReview(prior, outcome, now, DEFAULT_CONFIG));
  }, []);

  switch (view.screen) {
    case 'loading':
      return (
        <Shell>
          <p role="status" className="text-lg">
            Summoning the ghosts…
          </p>
        </Shell>
      );
    case 'error':
      return (
        <Shell>
          <div role="alert" className="text-center">
            <h1 className="text-2xl mb-2">The ghosts could not be summoned</h1>
            <p>Please reload the page to try again.</p>
          </div>
        </Shell>
      );
    case 'intro': {
      const { dataset } = view;
      return (
        <Shell>
          <IntroScreen
            onBegin={() => {
              setIntroSeen(true);
              startSeance(dataset);
            }}
          />
        </Shell>
      );
    }
    case 'menu': {
      const { dataset } = view;
      return (
        <Shell>
          <StartMenu
            onStartSeance={() => startSeance(dataset)}
            onReviewLegend={() => setView({ screen: 'intro', dataset })}
          />
        </Shell>
      );
    }
    case 'seance': {
      const { dataset, ghosts, sessionId } = view;
      return (
        <Shell>
          <SeanceSession
            key={sessionId}
            ghosts={ghosts}
            dataset={dataset}
            config={DEFAULT_CONFIG}
            onOutcome={handleOutcome}
            onComplete={(results) => setView({ screen: 'summary', dataset, results })}
          />
        </Shell>
      );
    }
    case 'summary': {
      const { dataset, results } = view;
      return (
        <Shell>
          <SessionSummary results={results} onPlayAgain={() => startSeance(dataset)} />
        </Shell>
      );
    }
  }
}
