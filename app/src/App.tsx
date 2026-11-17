import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  loadLevel,
  loadManifest,
  type CharacterDataset,
} from './data/charDataLoader';
import type { CharacterRecord, Level, LevelManifest } from './data/types';
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
  LEVELS,
  isLevelFinished,
  nextLevel,
  nextLevelToLoad,
  sessionCharacterList,
  unplacedHistoryKeys,
} from './engine/levels';
import {
  getIntroSeen,
  getLevel,
  getLevelChosen,
  isSavingWorking,
  loadState,
  recordOutcome,
  setCangjieIntroSeen,
  setIntroSeen,
  setLevel,
} from './storage/storage';
import { IntroScreen } from './components/IntroScreen';
import { CangjieGuide } from './components/CangjieGuide';
import { StartMenu } from './components/StartMenu';
import { SeanceSession } from './components/SeanceSession';
import { LevelScreen } from './components/LevelScreen';
import { Graveyard, type GraveyardStatus } from './components/Graveyard';
import { Credits } from './components/Credits';
import { scrollToTop } from './components/scrollToTop';
import { SessionSummary, type SessionResults } from './components/SessionSummary';

/**
 * Pure: pick tonight's ghosts. `selectSession` receives the Learning order
 * (stroke-count sorted), never the dataset's JSON key order (Req 6.12).
 * `characterList` replaces the Learning order with a Session_Pool.
 */
export function buildSession(
  dataset: CharacterDataset,
  history: ReviewHistory,
  now: number,
  config: EngineConfig,
  characterList: readonly string[] = learningOrder(dataset),
): CharacterRecord[] {
  const chars = selectSession(history, characterList, now, config);
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

/** Where a séance draws from when levels are in play. `dataset` of planSeance is the merged lookup. */
export interface SeanceScope {
  /** Learning order of the Chosen_Level. */
  readonly chosenOrder: readonly string[];
  /** Learning orders of the other loaded levels, ascending level. */
  readonly otherOrders: readonly (readonly string[])[];
  /** The level 1 order and dataset, for the Walkthrough_Ghost. */
  readonly walkthrough: { readonly order: readonly string[]; readonly dataset: CharacterDataset };
}

/** Pure: buildSession, then the walkthrough composition for a brand-new player. */
export function planSeance(
  dataset: CharacterDataset,
  history: ReviewHistory,
  now: number,
  config: EngineConfig,
  scope?: SeanceScope,
): SeancePlan {
  const base = scope
    ? buildSession(
        dataset,
        history,
        now,
        config,
        sessionCharacterList(scope.chosenOrder, history, scope.otherOrders),
      )
    : buildSession(dataset, history, now, config);
  let ghosts = base;
  let walkthroughChar: string | null = null;
  if (isBrandNewPlayer(history)) {
    const wOrder = scope ? scope.walkthrough.order : learningOrder(dataset);
    const wData = scope ? scope.walkthrough.dataset : dataset;
    const char = pickWalkthroughGhost(wOrder, wData);
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

type LevelMap = Partial<Record<Level, CharacterDataset>>;
type LevelStatus = { kind: 'idle' } | { kind: 'loading'; level: Level } | { kind: 'failed'; level: Level };

type View =
  | { screen: 'loading' }
  | { screen: 'error' }
  | { screen: 'intro' }
  | { screen: 'level'; origin: 'intro' | 'menu' }
  | { screen: 'menu' }
  | {
      screen: 'graveyard';
      history: ReviewHistory;
      now: number;
      level: Level;
      status: GraveyardStatus;
    }
  | { screen: 'credits'; origin: 'menu' | 'intro' }
  | { screen: 'cangjie-guide' }
  | ({ screen: 'seance'; sessionId: number } & SeancePlan)
  | { screen: 'summary'; results: SessionResults };

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

  const levelsRef = useRef<LevelMap>({});
  const [levels, setLevels] = useState<LevelMap>({});
  const [chosenLevel, setChosenLevel] = useState<Level>(() => getLevel());
  const [levelChosen, setLevelChosen] = useState<boolean>(() => getLevelChosen());
  const [manifest, setManifest] = useState<LevelManifest | null>(null);
  const [manifestFailed, setManifestFailed] = useState(false);
  const [levelStatus, setLevelStatus] = useState<LevelStatus>({ kind: 'idle' });

  const putLevel = useCallback((level: Level, dataset: CharacterDataset) => {
    levelsRef.current = { ...levelsRef.current, [level]: dataset };
    setLevels(levelsRef.current);
  }, []);

  /** Cached or fetched dataset of a level; never throws. */
  const ensureLevel = useCallback(
    async (level: Level): Promise<CharacterDataset | null> => {
      const cached = levelsRef.current[level];
      if (cached) return cached;
      const result = await loadLevel(level);
      if (!result.ok) return null;
      putLevel(level, result.dataset);
      return result.dataset;
    },
    [putLevel],
  );

  /** One Map of every loaded level; levels are disjoint, so nothing is overwritten. */
  const lookup = useMemo<CharacterDataset>(() => {
    const merged = new Map<string, CharacterRecord>();
    for (const level of LEVELS) {
      const ds = levels[level];
      if (ds) for (const [k, v] of ds) merged.set(k, v);
    }
    return merged;
  }, [levels]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const state = loadState();
      const loaded = new Set<Level>();
      for (;;) {
        const unplaced = unplacedHistoryKeys(
          state.history,
          LEVELS.filter((l) => loaded.has(l)).map(
            (l) => new Set(levelsRef.current[l]?.keys() ?? []),
          ),
        );
        const next = nextLevelToLoad(state.level, loaded, unplaced);
        if (next === null) break;
        const result = await loadLevel(next);
        if (!active) return;
        if (!result.ok) {
          setView({ screen: 'error' });
          return;
        }
        levelsRef.current = { ...levelsRef.current, [next]: result.dataset };
        loaded.add(next);
      }
      setLevels(levelsRef.current);
      setView({ screen: getIntroSeen() ? 'menu' : 'intro' });
    })();
    return () => {
      active = false;
    };
  }, []);

  const screenName = view.screen;
  useLayoutEffect(() => {
    scrollToTop();
  }, [screenName]);

  // The manifest is fetched only when the Level_Screen opens (Req 5.4, 5.5).
  useEffect(() => {
    if (screenName !== 'level' || manifest !== null) return;
    let active = true;
    setManifestFailed(false);
    void loadManifest().then((result) => {
      if (!active) return;
      if (result.ok) setManifest(result.manifest);
      else setManifestFailed(true);
    });
    return () => {
      active = false;
    };
  }, [screenName, manifest]);

  const startSeance = useCallback(
    (level: Level = chosenLevel) => {
      const now = Date.now();
      const map = levelsRef.current;
      const chosen = map[level];
      const level1 = map[1];
      if (!chosen || !level1) {
        setView({ screen: 'error' });
        return;
      }
      const scope: SeanceScope = {
        chosenOrder: learningOrder(chosen),
        otherOrders: LEVELS.filter((l) => l !== level && map[l] !== undefined).map((l) =>
          learningOrder(map[l]!),
        ),
        walkthrough: { order: learningOrder(level1), dataset: level1 },
      };
      const merged = new Map<string, CharacterRecord>();
      for (const l of LEVELS) {
        const ds = map[l];
        if (ds) for (const [k, v] of ds) merged.set(k, v);
      }
      const plan = planSeance(merged, loadState().history, now, DEFAULT_CONFIG, scope);
      returnsRef.current = new Map();
      setSavingWorks(isSavingWorking());
      setSessionCounter((n) => n + 1);
      setView({ screen: 'seance', sessionId: sessionCounter + 1, ...plan });
    },
    [chosenLevel, sessionCounter],
  );

  /** A tap on the Level_Screen: load, save, then start (first run) or return to the menu. */
  const chooseLevel = useCallback(
    async (level: Level, origin: 'intro' | 'menu') => {
      setLevelStatus({ kind: 'loading', level });
      const ds = await ensureLevel(level);
      if (ds === null) {
        setLevelStatus({ kind: 'failed', level });
        return;
      }
      setLevelStatus({ kind: 'idle' });
      setLevel(level);
      setChosenLevel(level);
      setLevelChosen(true);
      setSavingWorks(isSavingWorking());
      if (origin === 'intro') startSeance(level);
      else setView({ screen: 'menu' });
    },
    [ensureLevel, startSeance],
  );

  const changeGraveyardLevel = useCallback(
    async (level: Level) => {
      if (levelsRef.current[level]) {
        setView((v) => (v.screen === 'graveyard' ? { ...v, level, status: { kind: 'idle' } } : v));
        return;
      }
      setView((v) =>
        v.screen === 'graveyard' ? { ...v, status: { kind: 'loading', level } } : v,
      );
      const ds = await ensureLevel(level);
      setView((v) => {
        if (v.screen !== 'graveyard') return v;
        return ds === null
          ? { ...v, status: { kind: 'failed', level } }
          : { ...v, level, status: { kind: 'idle' } };
      });
    },
    [ensureLevel],
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
    case 'intro':
      return (
        <Shell tight>
          <IntroScreen
            onOpenSources={() => setView({ screen: 'credits', origin: 'intro' })}
            onBegin={() => {
              setIntroSeen(true);
              setSavingWorks(isSavingWorking());
              if (levelChosen) startSeance();
              else {
                setLevelStatus({ kind: 'idle' });
                setView({ screen: 'level', origin: 'intro' });
              }
            }}
          />
        </Shell>
      );
    case 'level': {
      const { origin } = view;
      return (
        <Shell tight>
          <LevelScreen
            manifest={manifest}
            manifestFailed={manifestFailed}
            currentLevel={origin === 'menu' ? chosenLevel : null}
            status={levelStatus}
            onChoose={(level) => void chooseLevel(level, origin)}
            onBack={origin === 'menu' ? () => setView({ screen: 'menu' }) : undefined}
          />
        </Shell>
      );
    }
    case 'menu': {
      const chosenDs = levels[chosenLevel];
      const finished =
        chosenDs !== undefined &&
        isLevelFinished(learningOrder(chosenDs), loadState().history);
      const following = nextLevel(chosenLevel);
      const finishedNotice = finished
        ? {
            text: `You have met every ghost of level ${chosenLevel}.`,
            ...(following !== null
              ? {
                  moveOn: {
                    label: `Move on to level ${following}`,
                    onClick: () => void chooseLevel(following, 'menu'),
                  },
                }
              : {}),
          }
        : null;
      return (
        <Shell>
          <StartMenu
            onStartSeance={() => startSeance()}
            onReviewLegend={() => setView({ screen: 'intro' })}
            onReviewCangjieGuide={() => setView({ screen: 'cangjie-guide' })}
            onOpenGraveyard={() =>
              setView({
                screen: 'graveyard',
                history: loadState().history,
                now: Date.now(),
                level: chosenLevel,
                status: { kind: 'idle' },
              })
            }
            onOpenCredits={() => setView({ screen: 'credits', origin: 'menu' })}
            level={chosenLevel}
            onChooseLevel={() => {
              setLevelStatus({ kind: 'idle' });
              setView({ screen: 'level', origin: 'menu' });
            }}
            finishedNotice={finishedNotice}
          />
        </Shell>
      );
    }
    case 'graveyard': {
      const { history, now, level, status } = view;
      return (
        <Shell>
          <Graveyard
            dataset={levels[level] ?? null}
            level={level}
            chosenLevel={chosenLevel}
            history={history}
            now={now}
            status={status}
            onChangeLevel={(l) => void changeGraveyardLevel(l)}
            onBack={() => setView({ screen: 'menu' })}
          />
        </Shell>
      );
    }
    case 'credits': {
      const { origin } = view;
      return (
        <Shell>
          <Credits
            backTo={origin}
            onBack={() => setView(origin === 'intro' ? { screen: 'intro' } : { screen: 'menu' })}
          />
        </Shell>
      );
    }
    case 'cangjie-guide': {
      const level1 = levels[1];
      if (!level1) return null;
      return (
        <Shell>
          <CangjieGuide
            dataset={level1}
            onContinue={() => {
              setCangjieIntroSeen(true);
              setSavingWorks(isSavingWorking());
              setView({ screen: 'menu' });
            }}
          />
        </Shell>
      );
    }
    case 'seance': {
      const { ghosts, sessionId, firstMeeting, walkthroughChar } = view;
      return (
        <Shell compact>
          <SeanceSession
            key={sessionId}
            ghosts={ghosts}
            dataset={lookup}
            config={DEFAULT_CONFIG}
            onOutcome={handleOutcome}
            savingWorks={savingWorks}
            firstMeeting={firstMeeting}
            walkthroughChar={walkthroughChar}
            onLeave={() => setView({ screen: 'menu' })}
            onComplete={(results) =>
              setView({
                screen: 'summary',
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
      const { results } = view;
      return (
        <Shell>
          <SessionSummary results={results} onPlayAgain={() => startSeance()} />
        </Shell>
      );
    }
  }
}
