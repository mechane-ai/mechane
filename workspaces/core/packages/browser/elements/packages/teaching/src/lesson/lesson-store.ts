import { createChange } from '@ui-sdk/core';
import type { ChangeDetails, ChangeSource, PrimitiveContext } from '@ui-sdk/core';
import { scrubTo } from '@ui-sdk/core/number';
import { paramProblem } from './define-lesson.ts';
import type { AnyLesson, LessonBeat, LessonParam, LessonValue, NumberParam } from './define-lesson.ts';
import { failLesson } from './lesson-error.tsx';
import { coercedValue, connectPersistence } from './lesson-persistence.ts';
import type { LessonParamValues } from './lesson-persistence.ts';
import { createPlayers } from './lesson-player.ts';
import type { LessonPlayer, LessonPlayingChangeReason, PlayOrigin } from './lesson-player.ts';

/** Why the values changed: a control or a key the reader used, a player, a reset, a value read back, or a call. */
export type LessonValuesChangeReason =
  | 'drag'
  | 'step-key'
  | 'track-press'
  | 'accessibility-adjust'
  | 'item-press'
  | 'list-navigation'
  | 'clear-press'
  | 'press'
  | 'playback'
  | 'scroll'
  | 'shortcut'
  | 'reset'
  | 'restore'
  | 'imperative';

/** Why the beat or the reveal step changed: a key in a presentation, scrolling, a press, or a call. */
export type LessonPlaceChangeReason = 'shortcut' | 'scroll' | 'link-press' | 'press' | 'restore' | 'imperative';

/** What a player starting or stopping reports: its reason, its event and its source, and `cancel()` to refuse it. */
export type LessonPlayingChangeDetails = ChangeDetails<LessonPlayingChangeReason>;

/** What a values change reports: its reason, its event and its source, and `cancel()` to refuse it. */
export type LessonValuesChangeDetails = ChangeDetails<LessonValuesChangeReason>;

/** What a beat or step change reports: its reason, its event and its source, and `cancel()` to refuse it. */
export type LessonPlaceChangeDetails = ChangeDetails<LessonPlaceChangeReason>;

/** What a change says about itself. Controls pass their own details through. */
export type LessonChangeOrigin<Reason extends string = LessonValuesChangeReason> = {
  readonly reason: Reason;
  readonly event?: Event | undefined;
  readonly source?: ChangeSource | undefined;
};

export type LessonPlaceOrigin = LessonChangeOrigin<LessonPlaceChangeReason>;

export type LessonStoreOptions = {
  readonly lesson: AnyLesson;
  readonly values?: LessonParamValues | undefined;
  readonly defaultValues?: LessonParamValues | undefined;
  readonly onValuesChange?: ((values: LessonParamValues, details: LessonValuesChangeDetails) => void) | undefined;
  readonly beat?: string | null | undefined;
  readonly defaultBeat?: string | null | undefined;
  readonly onBeatChange?: ((beat: string | null, details: LessonPlaceChangeDetails) => void) | undefined;
  readonly step?: number | undefined;
  readonly defaultStep?: number | undefined;
  readonly onStepChange?: ((step: number, details: LessonPlaceChangeDetails) => void) | undefined;
  readonly onPlayingChange?: ((playing: string | null, details: LessonPlayingChangeDetails) => void) | undefined;
  /** Who started the player that is running, so its steps are attributed to the same source. */
  readonly playSource?: (() => ChangeSource) | undefined;
  /** Steps the markup adds to a beat after its declared reveal steps, such as a scrolly's steps in a presentation. */
  readonly addedSteps?: Readonly<Record<string, number>> | undefined;
  readonly isReadOnly?: boolean | undefined;
  readonly shouldSyncUrl?: boolean | undefined;
  readonly storageKey?: string | undefined;
};

/** The lesson as the store holds it. Agents read `values`, `beat` and `step`. */
export type LessonStoreState = {
  readonly values: LessonParamValues;
  readonly beat: string | null;
  readonly step: number;
  /** The param a player is moving now, or null. */
  readonly playing: string | null;
  readonly players: Readonly<Record<string, LessonPlayer>>;
  readonly isReadOnly: boolean;
};

/** The details `createChange` takes, without the keys an origin leaves out. */
function detailsOf<Reason extends string>(
  origin: LessonChangeOrigin<Reason>,
): { readonly reason: Reason; readonly event?: Event; readonly source?: ChangeSource } {
  return {
    reason: origin.reason,
    ...(origin.event !== undefined && { event: origin.event }),
    ...(origin.source !== undefined && { source: origin.source }),
  };
}

/** The value as the param's kind holds it, on its step grid, or undefined when it is the wrong kind. */
function typedValue(param: LessonParam, value: unknown): LessonValue | undefined {
  switch (param.kind) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? scrubTo(value, param).value : undefined;
    case 'toggle':
      return typeof value === 'boolean' ? value : undefined;
    case 'choice':
      return typeof value === 'string' ? value : undefined;
  }
}

/** What the lesson store does: every change a part, a player or an agent asks of the lesson goes through it. */
export type LessonApi = {
  /** Sets one param to a value of its kind, with the change's origin. Throws when the value is out of range. */
  readonly apply: (name: string, value: unknown, origin: LessonChangeOrigin) => boolean;
  /** Sets one param: a number in its range, an option's id or label, or true or false. */
  readonly setParam: (name: string, value: unknown) => boolean;
  /** Sets several params in one change, so readers of the change see one move and not one per param. */
  readonly setParams: (values: Readonly<Record<string, unknown>>, origin?: LessonChangeOrigin) => boolean;
  /** Shows a state a beat declares: its values are set in one change. Looks in the current beat first. */
  readonly showState: (state: string, origin?: LessonChangeOrigin) => boolean;
  /** Puts every param back to the value the lesson opened with. */
  readonly reset: (origin?: LessonChangeOrigin) => boolean;
  /** Moves to a beat, at its first reveal step unless `step` says otherwise. */
  readonly setBeat: (beat: string, step?: number, origin?: LessonPlaceOrigin) => boolean;
  /** Shows the next reveal step, or the next beat at its first step. */
  readonly next: (origin?: LessonPlaceOrigin) => boolean;
  /** Hides the last reveal step, or goes back to the previous beat with every step shown. */
  readonly previous: (origin?: LessonPlaceOrigin) => boolean;
  /** Starts the player of a number param, or the only player when there is one. */
  readonly play: (name?: string, origin?: PlayOrigin) => void;
  /** Stops the player that is running. */
  readonly pause: (origin?: PlayOrigin) => void;
  /** Adds a player for a number param. Returns the function that removes it. */
  readonly register: (player: LessonPlayer) => () => void;
  /** Reads saved and linked values once the lesson is on the page, then keeps them current. */
  readonly connect: () => () => void;
};

/** The store's opening state, from the lesson and the values, beat and step it is given. */
export function lessonState(options: LessonStoreOptions): LessonStoreState {
  const firstBeat = options.lesson.beats[0]?.id ?? null;

  return {
    values: options.values ?? options.defaultValues ?? options.lesson.defaults,
    beat: options.beat ?? options.defaultBeat ?? firstBeat,
    step: options.step ?? options.defaultStep ?? 0,
    playing: null,
    players: {},
    isReadOnly: options.isReadOnly ?? false,
  };
}

/** The keys the store takes from the options on every render. */
export function lessonSync(options: LessonStoreOptions): Partial<LessonStoreState> {
  return {
    ...(options.values !== undefined && { values: options.values }),
    ...(options.beat !== undefined && { beat: options.beat }),
    ...(options.step !== undefined && { step: options.step }),
    isReadOnly: options.isReadOnly ?? false,
  };
}

/** The store's api, built once per lesson from the primitive's context. */
export function lessonApi(context: PrimitiveContext<LessonStoreOptions, LessonStoreState, 'root'>): LessonApi {
  const { store } = context;
  const change = createChange(context);

  function lesson(): AnyLesson {
    return context.options().lesson;
  }

  function refuse(message: string): never {
    return failLesson(lesson().id, message);
  }

  /** The values the lesson opened with, which `reset` returns to and a state fills its unnamed params from. */
  function opening(): LessonParamValues {
    return context.options().defaultValues ?? lesson().defaults;
  }

  /** The last step of a beat: its declared reveal steps and any the markup adds. */
  function lastStep(beat: LessonBeat): number {
    return (beat.steps ?? 0) + (context.options().addedSteps?.[beat.id] ?? 0);
  }

  function writable(): void {
    if (store.get().isReadOnly) {
      refuse('this copy is read-only.');
    }
  }

  function paramOf(name: string): LessonParam {
    const param = new Map(Object.entries(lesson().params)).get(name);

    return param ?? refuse(`there is no param "${name}". Its params: ${Object.keys(lesson().params).join(', ')}.`);
  }

  function numberParamOf(name: string): NumberParam {
    const param = paramOf(name);

    return param.kind === 'number' ? param : refuse(`"${name}" is not a number param, so no player can move it.`);
  }

  const players = createPlayers({
    playing: () => store.get().playing,
    setPlaying: (playing, origin) => change('playing', playing, detailsOf(origin ?? { reason: 'imperative' })),
    publish: (registered) => store.set({ players: registered }),
    value: (name) => Number(store.get().values[name]),
    grid: (player) => ({ min: numberParamOf(player.name).min, max: player.to, step: numberParamOf(player.name).step }),
    move: (name, value) =>
      apply(name, value, {
        reason: 'playback',
        source: context.options().playSource?.() === 'agent' ? 'agent' : 'programmatic',
      }),
    refuse,
  });

  context.onDestroy(() => players.pause());

  function apply(name: string, value: unknown, origin: LessonChangeOrigin): boolean {
    writable();

    const param = paramOf(name);
    const next = typedValue(param, value);
    const problem = paramProblem({ name, param, value: next ?? value });

    if (next === undefined || problem !== undefined) {
      refuse(problem ?? `${name} cannot take ${String(value)}.`);
    }

    const { values, playing } = store.get();

    if (values[name] === next) {
      return false;
    }

    if (playing === name && origin.reason !== 'playback') {
      players.pause();
    }

    return change('values', { ...values, [name]: next }, detailsOf(origin));
  }

  function applyAll(patch: Readonly<Record<string, unknown>>, origin: LessonChangeOrigin): boolean {
    writable();

    const { values, playing } = store.get();

    const entries = Object.entries(patch).map(([name, value]) => {
      const param = paramOf(name);
      const typed = typedValue(param, coercedValue(param, value));
      const problem = paramProblem({ name, param, value: typed ?? value });

      return typed === undefined || problem !== undefined
        ? refuse(problem ?? `${name} cannot take ${String(value)}.`)
        : ([name, typed] as const);
    });

    const changed = entries.filter(([name, value]) => values[name] !== value);

    if (changed.length === 0) {
      return false;
    }

    if (playing !== null && changed.some(([name]) => name === playing)) {
      players.pause();
    }

    return change('values', { ...values, ...Object.fromEntries(changed) }, detailsOf(origin));
  }

  function moveTo(beat: string, step: number, origin: LessonPlaceOrigin | undefined): boolean {
    const details = detailsOf(origin ?? { reason: 'imperative' });
    const current = store.get();
    const isOtherBeat = current.beat !== beat;

    if (isOtherBeat && !change('beat', beat, details)) {
      return false;
    }

    return current.step === step ? isOtherBeat : change('step', step, details);
  }

  function beatIndex(): number {
    const { beat } = store.get();

    return lesson().beats.findIndex((candidate) => candidate.id === beat);
  }

  return {
    apply,
    /** Sets one param: a number in its range, an option's id or label, or true or false. */
    setParam: (name: string, value: unknown) =>
      apply(name, coercedValue(paramOf(name), value), { reason: 'imperative' }),
    /** Sets several params in one change, so readers of the change see one move and not one per param. */
    setParams: (values: Readonly<Record<string, unknown>>, origin?: LessonChangeOrigin) =>
      applyAll(values, origin ?? { reason: 'imperative' }),
    /**
     * Shows a state a beat declares, in one change. A state is the whole picture: a param it does not name takes the
     * value the lesson opened with, so a state looks the same whenever it is shown. Looks in the current beat first.
     */
    showState(state: string, origin?: LessonChangeOrigin): boolean {
      const { beat } = store.get();

      const ordered = lesson().beats.toSorted(
        (first, second) => Number(second.id === beat) - Number(first.id === beat),
      );

      const found = ordered.flatMap((item) => item.states ?? []).find((item) => item.id === state);

      return found === undefined
        ? refuse(`no beat declares a state "${state}".`)
        : applyAll({ ...opening(), ...found.values }, origin ?? { reason: 'imperative' });
    },
    /** Puts every param back to the value the lesson opened with. */
    reset(origin?: LessonChangeOrigin): boolean {
      writable();
      players.pause();

      return change('values', opening(), detailsOf(origin ?? { reason: 'reset' }));
    },
    /** Moves to a beat, at its first reveal step unless `step` says otherwise. */
    setBeat(beat: string, step = 0, origin?: LessonPlaceOrigin): boolean {
      writable();

      const target = lesson().beats.find((candidate) => candidate.id === beat);

      if (target === undefined) {
        refuse(
          `there is no beat "${beat}". Its beats: ${lesson()
            .beats.map((item) => item.id)
            .join(', ')}.`,
        );
      }

      const isWholeStep = Number.isInteger(step) && step >= 0;
      const isStepKnown = isWholeStep && step <= lastStep(target);

      if (!isStepKnown) {
        refuse(`beat "${beat}" has reveal steps 0 to ${lastStep(target)}, not ${step}.`);
      }

      return moveTo(beat, step, origin);
    },
    /** Shows the next reveal step, or the next beat at its first step. */
    next(origin?: LessonPlaceOrigin): boolean {
      writable();

      const index = beatIndex();
      const { step } = store.get();

      const current = lesson().beats[index];

      if (current !== undefined && step < lastStep(current)) {
        return change('step', step + 1, detailsOf(origin ?? { reason: 'imperative' }));
      }

      const following = lesson().beats[index + 1];

      return following === undefined ? false : moveTo(following.id, 0, origin);
    },
    /** Hides the last reveal step, or goes back to the previous beat with every step shown. */
    previous(origin?: LessonPlaceOrigin): boolean {
      writable();

      const index = beatIndex();
      const { step } = store.get();

      if (step > 0) {
        return change('step', step - 1, detailsOf(origin ?? { reason: 'imperative' }));
      }

      const before = index > 0 ? lesson().beats[index - 1] : undefined;

      return before === undefined ? false : moveTo(before.id, lastStep(before), origin);
    },
    /** Starts the player of a number param, or the only player when there is one. */
    play(name?: string, origin?: PlayOrigin): void {
      writable();
      players.play(name, origin);
    },
    /** Stops the player that is running. */
    pause: players.pause,
    /** Adds a player for a number param. Returns the function that removes it. */
    register(player: LessonPlayer): () => void {
      numberParamOf(player.name);

      return players.register(player);
    },
    /** Reads saved and linked values once the lesson is on the page, then keeps them current. */
    connect(): () => void {
      const { shouldSyncUrl, storageKey } = context.options();

      return connectPersistence({
        lesson: lesson(),
        shouldSyncUrl: shouldSyncUrl ?? false,
        storageKey,
        read: () => store.get().values,
        subscribe: (listener) => store.subscribe(listener),
        restore: (values) => {
          if (Object.keys(values).length > 0 && !store.get().isReadOnly) {
            change('values', { ...store.get().values, ...values }, { reason: 'restore' });
          }
        },
      });
    },
  };
}
