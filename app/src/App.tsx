import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadDataset, type CharacterDataset } from './data/charDataLoader';
import type { CharacterRecord } from './data/types';
import { DEFAULT_CONFIG, type EngineConfig } from './engine/config';
import { learningOrder } from './engine/learningOrder';
import {
  applyReview,
  selectSession,
  type Outcome,
  type ReviewEntry,
  type ReviewHistory,
} from './engine/scheduler';
import { firstMeetingSet, isBrandNewPlayer } from './engine/firstMeeting';
import { composeFirstSession, pickWalkthroughGhost } from './engine/walkthrough';
import { buildReturnRows } from './engine/formatReturn';
import {
  getIntroSeen,
  isSavingWorking,
  loadState,
  recordOutcome,
  setCangjieIntroSeen,
  setIntroSeen,
} from './storage/storage';
import { IntroScreen } from './components/IntroScreen';
import { CangjieGuide } from './components/CangjieGuide';
import { StartMenu } from './components/StartMenu';
import { SeanceSession } from './components/SeanceSession';
import { Graveyard } from './components/Graveyard';
import { Credits } from './components/Credits';
import { scrollToTop } from './components/scrollToTop';
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

export interface SeancePlan {
  readonly ghosts: CharacterRecord[];
  readonly firstMeeting: ReadonlySet<string>;
  readonly walkthroughChar: string | null;
}

/** Pure: buildSession, then the walkthrough composition for a brand-new player. */
export function planSeance(
  dataset: CharacterDataset,
  history: ReviewHistory,
  now: number,
  config: EngineConfig,
): SeancePlan {
  const base = buildSession(dataset, history, now, config);
  let ghosts = base;
  let walkthroughChar: string | null = null;
  if (isBrandNewPlayer(history)) {
    const char = pickWalkthroughGhost(learningOrder(dataset), dataset);
    const record = char === null ? undefined : dataset.get(char);
    if (record !== undefined) {
      ghosts = composeFirstSession(base, record, config.sessionSize);
      walkthroughChar = record.character;
    }
  }
  return {
    ghosts,
    firstMeeting: firstMeetingSet(
      history,
      ghosts.map((g) => g.character),
    ),
    walkthroughChar,
  };
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
  | { screen: 'graveyard'; dataset: CharacterDataset; history: ReviewHistory; now: number }
  | { screen: 'credits'; dataset: CharacterDataset; origin: 'menu' | 'intro' }
  | { screen: 'cangjie-guide'; dataset: CharacterDataset; }
  | ({ screen: 'seance'; dataset: CharacterDataset; sessionId: number } & SeancePlan)
  | { screen: 'summary'; dataset: CharacterDataset; results: SessionResults };

function Shell({
  children,
  compact = false,
  tight = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
  tight?: boolean;
}) {
  const sizing = compact
    ? 'no-moon-room min-h-[100dvh] px-2 py-2'
    : tight
      ? 'min-h-screen px-4 py-2'
      : 'min-h-screen px-4 py-6';
  return (
    <main className={`${sizing} w-full flex items-center justify-center text-ink`}>
      <div className="w-full max-w-3xl flex flex-col items-center">{children}</div>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState<View>({ screen: 'loading' });
  const [sessionCounter, setSessionCounter] = useState(0);
  const [savingWorks, setSavingWorks] = useState(() => isSavingWorking());
  const returnsRef = useRef(new Map<string, ReviewEntry>());

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

  useLayoutEffect(() => {
    scrollToTop();
  }, [view.screen]);

  const startSeance = useCallback(
    (dataset: CharacterDataset) => {
      const now = Date.now();
      const plan = planSeance(dataset, loadState().history, now, DEFAULT_CONFIG);
      returnsRef.current = new Map();
      setSavingWorks(isSavingWorking());
      setSessionCounter((n) => n + 1);
      setView({ screen: 'seance', dataset, sessionId: sessionCounter + 1, ...plan });
    },
    [sessionCounter],
  );

  const handleOutcome = useCallback((char: string, outcome: Outcome, now: number) => {
    const prior = priorEntry(loadState().history, char);
    const entry = applyReview(prior, outcome, now, DEFAULT_CONFIG);
    recordOutcome(char, entry);
    returnsRef.current.set(char, entry);
    setSavingWorks(isSavingWorking());
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
        <Shell tight>
          <IntroScreen
            onOpenSources={() => setView({ screen: 'credits', dataset, origin: 'intro' })}
            onBegin={() => {
              setIntroSeen(true);
              setSavingWorks(isSavingWorking());
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
            onReviewCangjieGuide={() =>
              setView({ screen: 'cangjie-guide', dataset })
            }
            onOpenGraveyard={() =>
              setView({ screen: 'graveyard', dataset, history: loadState().history, now: Date.now() })
            }
            onOpenCredits={() => setView({ screen: 'credits', dataset, origin: 'menu' })}
          />
        </Shell>
      );
    }
    case 'graveyard': {
      const { dataset, history, now } = view;
      return (
        <Shell>
          <Graveyard
            dataset={dataset}
            history={history}
            now={now}
            onBack={() => setView({ screen: 'menu', dataset })}
          />
        </Shell>
      );
    }
    case 'credits': {
      const { dataset, origin } = view;
      return (
        <Shell>
          <Credits
            backTo={origin}
            onBack={() =>
              setView(origin === 'intro' ? { screen: 'intro', dataset } : { screen: 'menu', dataset })
            }
          />
        </Shell>
      );
    }
    case 'cangjie-guide': {
      const { dataset } = view;
      return (
        <Shell>
          <CangjieGuide
            dataset={dataset}
            onContinue={() => {
              setCangjieIntroSeen(true);
              setSavingWorks(isSavingWorking());
              setView({ screen: 'menu', dataset });
            }}
          />
        </Shell>
      );
    }
    case 'seance': {
      const { dataset, ghosts, sessionId, firstMeeting, walkthroughChar } = view;
      return (
        <Shell compact>
          <SeanceSession
            key={sessionId}
            ghosts={ghosts}
            dataset={dataset}
            config={DEFAULT_CONFIG}
            onOutcome={handleOutcome}
            savingWorks={savingWorks}
            firstMeeting={firstMeeting}
            walkthroughChar={walkthroughChar}
            onLeave={() => setView({ screen: 'menu', dataset })}
            onComplete={(results) =>
              setView({
                screen: 'summary',
                dataset,
                results: {
                  ...results,
                  returns: buildReturnRows(ghosts, returnsRef.current),
                  finishedAt: Date.now(),
                },
              })
            }
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
