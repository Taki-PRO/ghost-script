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
import { planReview, recordReview, restlessCount } from './engine/review';
import { crossLevelLine, isDueAt, type PlannedGhost } from './engine/crossLevel';
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
import { SkyCap } from './components/SkyCap';
import { SoundToggle } from './components/SoundToggle';
import { SoundProvider, useSound } from './audio/SoundProvider';
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
  /** Level (null without a scope) and due-at-planning flag of each planned ghost, in session order. */
  readonly report: readonly PlannedGhost[];
}

/** Where a séance draws from when levels are in play. `dataset` of planSeance is the merged lookup. */
export interface SeanceScope {
  /** Learning order of the Chosen_Level. */
  readonly chosenOrder: readonly string[];
  /** Learning orders of the other loaded levels, ascending level. */
  readonly otherOrders: readonly (readonly string[])[];
  /** The level 1 order and dataset, for the Walkthrough_Ghost. */
  readonly walkthrough: { readonly order: readonly string[]; readonly dataset: CharacterDataset };
  /** The level the player chose. */
  readonly chosenLevel: Level;
  /** The level each character belongs to. */
  readonly levelOf: ReadonlyMap<string, Level>;
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
    report: ghosts.map((g) => ({
      character: g.character,
      level: scope?.levelOf.get(g.character) ?? null,
      due: isDueAt(Object.prototype.hasOwnProperty.call(history, g.character) ? history[g.character] : undefined, now),
    })),
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
  | ({
      screen: 'seance';
      sessionId: number;
      mode: 'nightly' | 'review';
      crossLevelLine: string | null;
    } & SeancePlan)
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
    ? 'no-moon-room min-h-[100dvh] px-2 py-1'
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
  return (
    <SoundProvider>
      <SkyCap />
      <AppScreens />
    </SoundProvider>
  );
}

function AppScreens() {
  const [view, setView] = useState<View>({ screen: 'loading' });
  const [sessionCounter, setSessionCounter] = useState(0);
  const [savingWorks, setSavingWorks] = useState(() => isSavingWorking());
  const returnsRef = useRef(new Map<string, ReviewEntry>());
  const outcomesRef = useRef(new Map<string, Outcome>());
  const modeRef = useRef<'nightly' | 'review'>('nightly');
  const [reviewError, setReviewError] = useState(false);

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

  /**
   * Loads level 1, the chosen level and every level that holds a history key no
   * loaded level has. Writes only `levelsRef`; returns false when a load fails.
   */
  const ensureHistoryLevels = useCallback(
    async (history: ReviewHistory, chosen: Level): Promise<boolean> => {
      for (;;) {
        const loaded = new Set<Level>(LEVELS.filter((l) => levelsRef.current[l] !== undefined));
        const unplaced = unplacedHistoryKeys(
          history,
          LEVELS.filter((l) => loaded.has(l)).map(
            (l) => new Set(levelsRef.current[l]?.keys() ?? []),
          ),
        );
        const next = nextLevelToLoad(chosen, loaded, unplaced);
        if (next === null) return true;
        const result = await loadLevel(next);
        if (!result.ok) return false;
        levelsRef.current = { ...levelsRef.current, [next]: result.dataset };
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const state = loadState();
      const ok = await ensureHistoryLevels(state.history, state.level);
      if (!active) return;
      if (!ok) {
        setView({ screen: 'error' });
        return;
      }
      setLevels(levelsRef.current);
      setView({ screen: getIntroSeen() ? 'menu' : 'intro' });
    })();
    return () => {
      active = false;
    };
  }, [ensureHistoryLevels]);

  const screenName = view.screen;
  const { setAmbientScreen } = useSound();
  useEffect(() => {
    setAmbientScreen(screenName === 'menu' || screenName === 'graveyard');
  }, [screenName, setAmbientScreen]);
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
        chosenLevel: level,
        levelOf: new Map(
          LEVELS.flatMap((l) => [...(map[l]?.keys() ?? [])].map((c): [string, Level] => [c, l])),
        ),
      };
      const merged = new Map<string, CharacterRecord>();
      for (const l of LEVELS) {
        const ds = map[l];
        if (ds) for (const [k, v] of ds) merged.set(k, v);
      }
      const plan = planSeance(merged, loadState().history, now, DEFAULT_CONFIG, scope);
      returnsRef.current = new Map();
      outcomesRef.current = new Map();
      modeRef.current = 'nightly';
      setReviewError(false);
      setSavingWorks(isSavingWorking());
      setSessionCounter((n) => n + 1);
      const line = crossLevelLine(plan.report, level, plan.walkthroughChar !== null, false);
      setView({
        screen: 'seance',
        sessionId: sessionCounter + 1,
        mode: 'nightly',
        crossLevelLine: line,
        ...plan,
      });
    },
    [chosenLevel, sessionCounter],
  );

  /** Start a Review_Run over the restless ghosts of every level (Req 10.10 to 10.14, 10.28). */
  const startReview = useCallback(async () => {
    setReviewError(false);
    const ok = await ensureHistoryLevels(loadState().history, chosenLevel);
    if (!ok) {
      setReviewError(true);
      return;
    }
    setLevels(levelsRef.current);
    const map = levelsRef.current;
    const loadedLevels = LEVELS.filter((l) => map[l] !== undefined);
    const merged = new Map<string, CharacterRecord>();
    for (const l of loadedLevels) for (const [k, v] of map[l]!) merged.set(k, v);
    const ids = planReview(
      loadedLevels.map((l) => learningOrder(map[l]!)),
      loadState().history,
      Date.now(),
      DEFAULT_CONFIG,
    );
    const ghosts: CharacterRecord[] = [];
    for (const id of ids) {
      const record = merged.get(id);
      if (record !== undefined) ghosts.push(record);
    }
    if (ghosts.length === 0) return;
    returnsRef.current = new Map();
    outcomesRef.current = new Map();
    modeRef.current = 'review';
    setSavingWorks(isSavingWorking());
    setSessionCounter((n) => n + 1);
    setView({
      screen: 'seance',
      sessionId: sessionCounter + 1,
      mode: 'review',
      ghosts,
      firstMeeting: new Set<string>(),
      walkthroughChar: null,
      report: [],
      crossLevelLine: null,
    });
  }, [ensureHistoryLevels, chosenLevel, sessionCounter]);

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
    // A clean review stores nothing; the summary then shows the entry as it is stored.
    const entry =
      modeRef.current === 'review'
        ? recordReview(prior, outcome, now, DEFAULT_CONFIG)
        : applyReview(prior, outcome, now, DEFAULT_CONFIG);
    if (entry !== null) recordOutcome(char, entry);
    const stored = entry ?? prior;
    if (stored !== undefined) returnsRef.current.set(char, stored);
    outcomesRef.current.set(char, outcome);
    setSavingWorks(isSavingWorking());
  }, []);

  const renderScreen = (): JSX.Element | null => {
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
            onOpenGraveyard={() => {
              setReviewError(false);
              setView({
                screen: 'graveyard',
                history: loadState().history,
                now: Date.now(),
                level: chosenLevel,
                status: { kind: 'idle' },
              });
            }}
            onOpenCredits={() => setView({ screen: 'credits', origin: 'menu' })}
            level={chosenLevel}
            onChooseLevel={() => {
              setLevelStatus({ kind: 'idle' });
              setView({ screen: 'level', origin: 'menu' });
            }}
            finishedNotice={finishedNotice}
            restlessCount={restlessCount(loadState().history, Date.now(), new Set(lookup.keys()))}
            onReviewRestless={() => void startReview()}
            reviewError={reviewError}
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
            onBack={() => {
              setReviewError(false);
              setView({ screen: 'menu' });
            }}
            restlessCount={restlessCount(history, now, new Set(lookup.keys()))}
            onReviewRestless={() => void startReview()}
            reviewError={reviewError}
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
      const {
        ghosts,
        sessionId,
        mode,
        firstMeeting,
        walkthroughChar,
        crossLevelLine: seanceLine,
      } = view;
      return (
        <Shell compact>
          <SeanceSession
            key={sessionId}
            mode={mode}
            ghosts={ghosts}
            dataset={lookup}
            config={DEFAULT_CONFIG}
            onOutcome={handleOutcome}
            savingWorks={savingWorks}
            firstMeeting={firstMeeting}
            walkthroughChar={walkthroughChar}
            crossLevelLine={seanceLine}
            onLeave={() => setView({ screen: 'menu' })}
            onComplete={(results) =>
              setView({
                screen: 'summary',
                results: {
                  ...results,
                  mode,
                  returns: buildReturnRows(ghosts, returnsRef.current, outcomesRef.current),
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
          <SessionSummary results={results} onPlayAgain={() => startSeance()}
            onBackToMenu={() => setView({ screen: 'menu' })}
          />
        </Shell>
      );
    }
  }
  };

  const showToggle = view.screen !== 'loading' && view.screen !== 'error';
  return (
    <>
      {renderScreen()}
      {showToggle ? <SoundToggle /> : null}
    </>
  );
}
