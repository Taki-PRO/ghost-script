// Test double for AudioContext and the node graph the recipes use.
// Imported by tests only, never by app code (task 13.1 scans for this).
// It records every call so tests can assert on the graph without real audio.

export type MockState = 'suspended' | 'interrupted' | 'running' | 'closed';
export type NodeKind = 'oscillator' | 'bufferSource' | 'gain' | 'biquad' | 'compressor' | 'destination';
export type ParamMethod =
  | 'setValueAtTime'
  | 'linearRampToValueAtTime'
  | 'exponentialRampToValueAtTime'
  | 'setTargetAtTime'
  | 'cancelScheduledValues';

export interface ParamEvent {
  method: ParamMethod;
  args: number[];
}

/** Names of methods that can be told to throw (`throwOn`). */
export type ThrowingMethod =
  | 'createOscillator'
  | 'createBufferSource'
  | 'createBuffer'
  | 'createGain'
  | 'createBiquadFilter'
  | 'createDynamicsCompressor'
  | 'connect'
  | 'disconnect'
  | 'start'
  | 'stop'
  | 'suspend'
  | 'close';

export interface MockOptions {
  /** Constructor throws this error. */
  ctorThrows?: unknown;
  /** State right after construction. Default 'suspended'. */
  initialState?: MockState;
  /** What resume() does. Default 'resolve'. 'hang' never settles. */
  resume?: 'resolve' | 'reject' | 'hang';
  /** State after a resolved resume(). Default 'running'. */
  stateAfterResume?: MockState;
  /** Methods that throw when called. */
  throwOn?: readonly ThrowingMethod[];
  sampleRate?: number;
}

export interface SourceStart {
  node: MockNode;
  kind: 'oscillator' | 'bufferSource';
  when: number;
}

export interface MockLog {
  /** One entry per attempted construction, including ones that threw. */
  constructions: number;
  contexts: MockAudioContext[];
  resumeCalls: number;
  suspendCalls: number;
  closeCalls: number;
  sourceStarts: SourceStart[];
  sourceStops: { node: MockNode; when: number }[];
}

export function createLog(): MockLog {
  return {
    constructions: 0,
    contexts: [],
    resumeCalls: 0,
    suspendCalls: 0,
    closeCalls: 0,
    sourceStarts: [],
    sourceStops: [],
  };
}

export class MockParam {
  events: ParamEvent[] = [];
  constructor(public value: number) {}
  private rec(method: ParamMethod, args: number[]): MockParam {
    this.events.push({ method, args });
    return this;
  }
  setValueAtTime(v: number, t: number): MockParam {
    this.value = v;
    return this.rec('setValueAtTime', [v, t]);
  }
  linearRampToValueAtTime(v: number, t: number): MockParam {
    return this.rec('linearRampToValueAtTime', [v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number): MockParam {
    return this.rec('exponentialRampToValueAtTime', [v, t]);
  }
  setTargetAtTime(v: number, t: number, c: number): MockParam {
    return this.rec('setTargetAtTime', [v, t, c]);
  }
  cancelScheduledValues(t: number): MockParam {
    return this.rec('cancelScheduledValues', [t]);
  }
}

export class MockNode {
  connections: MockNode[] = [];
  disconnects: (MockNode | undefined)[] = [];
  params: Record<string, MockParam> = {};
  // Oscillator and source fields.
  type = '';
  buffer: MockBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  started: number[] = [];
  stopped: number[] = [];
  constructor(
    public kind: NodeKind,
    private ctx: MockAudioContext | null,
    paramDefaults: Record<string, number> = {},
  ) {
    for (const [name, v] of Object.entries(paramDefaults)) this.params[name] = new MockParam(v);
  }
  get frequency(): MockParam { return this.params.frequency; }
  get gain(): MockParam { return this.params.gain; }
  get Q(): MockParam { return this.params.Q; }
  get detune(): MockParam { return this.params.detune; }
  get playbackRate(): MockParam { return this.params.playbackRate; }
  get threshold(): MockParam { return this.params.threshold; }
  get knee(): MockParam { return this.params.knee; }
  get ratio(): MockParam { return this.params.ratio; }
  get attack(): MockParam { return this.params.attack; }
  get release(): MockParam { return this.params.release; }

  private check(name: ThrowingMethod): void {
    this.ctx?.maybeThrow(name);
  }
  connect(dest: MockNode | MockParam): MockNode | MockParam {
    this.check('connect');
    if (dest instanceof MockNode) this.connections.push(dest);
    return dest;
  }
  disconnect(dest?: MockNode): void {
    this.check('disconnect');
    this.disconnects.push(dest);
    this.connections = dest ? this.connections.filter((n) => n !== dest) : [];
  }
  start(when = 0): void {
    this.check('start');
    this.started.push(when);
    if (this.kind === 'oscillator' || this.kind === 'bufferSource') {
      this.ctx?.log.sourceStarts.push({ node: this, kind: this.kind, when });
    }
  }
  stop(when = 0): void {
    this.check('stop');
    this.stopped.push(when);
    this.ctx?.log.sourceStops.push({ node: this, when });
  }
  /** Test helper: fire the `ended` callback. */
  end(): void {
    this.onended?.();
  }
}

export class MockBuffer {
  private data: Float32Array[];
  constructor(public numberOfChannels: number, public length: number, public sampleRate: number) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration(): number { return this.length / this.sampleRate; }
  getChannelData(c: number): Float32Array { return this.data[c]; }
}

export class MockAudioContext {
  state: MockState;
  currentTime = 0;
  sampleRate: number;
  destination: MockNode;
  onstatechange: (() => void) | null = null;
  /** Every node created, in order. */
  nodes: MockNode[] = [];
  buffers: MockBuffer[] = [];

  constructor(
    public log: MockLog,
    public options: MockOptions = {},
  ) {
    log.constructions += 1;
    if (options.ctorThrows !== undefined) throw options.ctorThrows;
    this.state = options.initialState ?? 'suspended';
    this.sampleRate = options.sampleRate ?? 44100;
    this.destination = new MockNode('destination', null);
    log.contexts.push(this);
  }

  maybeThrow(name: ThrowingMethod): void {
    if (this.options.throwOn?.includes(name)) throw new Error(`mock ${name} failed`);
  }
  private make(
    name: ThrowingMethod,
    kind: NodeKind,
    params: Record<string, number> = {},
  ): MockNode {
    this.maybeThrow(name);
    const n = new MockNode(kind, this, params);
    this.nodes.push(n);
    return n;
  }
  createOscillator(): MockNode {
    return this.make('createOscillator', 'oscillator', { frequency: 440, detune: 0 });
  }
  createBufferSource(): MockNode {
    return this.make('createBufferSource', 'bufferSource', { playbackRate: 1 });
  }
  createGain(): MockNode {
    return this.make('createGain', 'gain', { gain: 1 });
  }
  createBiquadFilter(): MockNode {
    return this.make('createBiquadFilter', 'biquad', { frequency: 350, Q: 1, gain: 0, detune: 0 });
  }
  createDynamicsCompressor(): MockNode {
    return this.make('createDynamicsCompressor', 'compressor', {
      threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25,
    });
  }
  createBuffer(channels: number, length: number, sampleRate: number): MockBuffer {
    this.maybeThrow('createBuffer');
    const b = new MockBuffer(channels, length, sampleRate);
    this.buffers.push(b);
    return b;
  }
  /** Applies the state change and notifies the listener, like a real context. */
  setState(s: MockState): void {
    this.state = s;
    this.onstatechange?.();
  }
  resume(): Promise<void> {
    this.log.resumeCalls += 1;
    const mode = this.options.resume ?? 'resolve';
    if (mode === 'reject') return Promise.reject(new Error('mock resume rejected'));
    if (mode === 'hang') return new Promise<void>(() => {});
    return Promise.resolve().then(() => {
      if (this.state !== 'closed') this.setState(this.options.stateAfterResume ?? 'running');
    });
  }
  suspend(): Promise<void> {
    this.log.suspendCalls += 1;
    try {
      this.maybeThrow('suspend');
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve().then(() => {
      if (this.state !== 'closed') this.setState('suspended');
    });
  }
  close(): Promise<void> {
    this.log.closeCalls += 1;
    try {
      this.maybeThrow('close');
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve().then(() => this.setState('closed'));
  }
}

export interface MockHandle {
  log: MockLog;
  /** Builds a context directly (for an injected `createContext`). */
  create(): MockAudioContext;
  /** Latest context built, if any. */
  readonly last: MockAudioContext | undefined;
  restore(): void;
}

/** Context factory without touching globals, for injection into the engine. */
export function createMock(options: MockOptions = {}): MockHandle {
  const log = createLog();
  return {
    log,
    create: () => new MockAudioContext(log, options),
    get last() { return log.contexts[log.contexts.length - 1]; },
    restore() {},
  };
}

type AudioGlobals = { AudioContext?: unknown; webkitAudioContext?: unknown };

/**
 * Installs the mock as globalThis.AudioContext and/or webkitAudioContext.
 * `only: 'webkit'` leaves the standard name undefined. Call restore() in afterEach.
 */
export function installAudioMock(
  options: MockOptions = {},
  only: 'both' | 'standard' | 'webkit' = 'both',
): MockHandle {
  const g = globalThis as unknown as AudioGlobals;
  const had = {
    std: Object.prototype.hasOwnProperty.call(g, 'AudioContext'),
    wk: Object.prototype.hasOwnProperty.call(g, 'webkitAudioContext'),
  };
  const prev = { std: g.AudioContext, wk: g.webkitAudioContext };
  const log = createLog();
  const Ctor = function MockCtor() {
    return new MockAudioContext(log, options);
  } as unknown;
  if (only === 'webkit') delete g.AudioContext;
  else g.AudioContext = Ctor;
  if (only === 'standard') delete g.webkitAudioContext;
  else g.webkitAudioContext = Ctor;
  return {
    log,
    create: () => new MockAudioContext(log, options),
    get last() { return log.contexts[log.contexts.length - 1]; },
    restore() {
      if (had.std) g.AudioContext = prev.std; else delete g.AudioContext;
      if (had.wk) g.webkitAudioContext = prev.wk; else delete g.webkitAudioContext;
    },
  };
}
