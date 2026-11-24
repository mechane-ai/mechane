import { createChange, createLocalStorage, definePrimitive } from '@ui-sdk/core';
import type { ChangeDetails, ChangeSource } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import { useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';

/** A prediction the reader committed: their guess, the answer at that moment, and whether the guess was right. */
export type PredictionRecord = {
  readonly value: number | string;
  readonly answer: number | string;
  readonly isCorrect: boolean;
};

/**
 * What the reader has done in one article. Only the reader's own acts count: an agent's change never commits a
 * prediction, reaches a challenge or shows a hint.
 */
export type LessonProgress = {
  /** Each committed prediction, by the `Predict` id. */
  readonly predictions: Readonly<Record<string, PredictionRecord>>;
  /** The ids of the challenges the reader reached, in the order reached. */
  readonly reached: ReadonlyArray<string>;
  /** How many hints the reader asked for, by the `Challenge` id. */
  readonly hints: Readonly<Record<string, number>>;
  /** The ids of the beats the reader has been on, in the order first visited. */
  readonly visited: ReadonlyArray<string>;
};

/** Why the progress changed: a commit, a challenge reached, a hint asked for, a beat visited, a restore or a reset. */
export type ProgressChangeReason = 'commit' | 'reach' | 'hint-press' | 'visit' | 'restore' | 'reset';

/** What a progress change reports: its reason, event and source, and `cancel()` to refuse it. */
export type ProgressChangeDetails = ChangeDetails<ProgressChangeReason>;

/** What a progress change says about itself. */
export type ProgressOrigin = {
  readonly reason: ProgressChangeReason;
  readonly event?: Event | undefined;
  readonly source?: ChangeSource | undefined;
};

export const emptyProgress = { predictions: {}, reached: [], hints: {}, visited: [] } as const satisfies LessonProgress;

/** Where the reader's progress lives: controlled, kept by the article, or saved under a storage key as well. */
export type ProgressOptions = {
  readonly progress?: LessonProgress | undefined;
  readonly defaultProgress?: LessonProgress | undefined;
  readonly onProgressChange?: ((progress: LessonProgress, details: ProgressChangeDetails) => void) | undefined;
  readonly storageKey?: string | undefined;
};

type ProgressState = { readonly progress: LessonProgress };

const NUMBER_MARK = 'n:';
const TEXT_MARK = 's:';
const PREDICTION = 'p.';
const HINT = 'h.';

function encodedValue(value: number | string): string {
  return typeof value === 'number' ? `${NUMBER_MARK}${value}` : `${TEXT_MARK}${value}`;
}

function decodedValue(text: string | null): number | string | undefined {
  if (text?.startsWith(TEXT_MARK) === true) {
    return text.slice(TEXT_MARK.length);
  }

  const number = text?.startsWith(NUMBER_MARK) === true ? Number(text.slice(NUMBER_MARK.length)) : Number.NaN;

  return Number.isFinite(number) ? number : undefined;
}

/** The progress as query text: one key per fact, so a value edited by hand that no reader wrote is skipped. */
function encodeProgress(progress: LessonProgress): string {
  return new URLSearchParams([
    ...Object.entries(progress.predictions).flatMap(([id, record]) => [
      [`p.${id}.v`, encodedValue(record.value)],
      [`p.${id}.a`, encodedValue(record.answer)],
      [`p.${id}.c`, String(record.isCorrect)],
    ]),
    ...progress.reached.map((id) => ['r', id]),
    ...Object.entries(progress.hints).map(([id, count]) => [`h.${id}`, String(count)]),
    ...progress.visited.map((id) => ['v', id]),
  ]).toString();
}

function decodeProgress(text: string): LessonProgress {
  const query = new URLSearchParams(text);
  const keys = [...query.keys()];

  const predictionIds = new Set(
    keys.filter((key) => key.startsWith(PREDICTION)).map((key) => key.slice(PREDICTION.length, key.lastIndexOf('.'))),
  );

  const predictions = [...predictionIds].flatMap((id) => {
    const value = decodedValue(query.get(`p.${id}.v`));
    const answer = decodedValue(query.get(`p.${id}.a`));

    return value === undefined || answer === undefined
      ? []
      : [[id, { value, answer, isCorrect: query.get(`p.${id}.c`) === 'true' }] as const];
  });

  const hints = keys.flatMap((key) => {
    const count = Number(query.get(key));

    return key.startsWith(HINT) && Number.isInteger(count) && count > 0
      ? [[key.slice(HINT.length), count] as const]
      : [];
  });

  return {
    predictions: Object.fromEntries(predictions),
    reached: [...new Set(query.getAll('r'))],
    hints: Object.fromEntries(hints),
    visited: [...new Set(query.getAll('v'))],
  };
}

/** The progress kept before this visit with what the reader has done since the page opened. */
function mergedProgress(now: LessonProgress, saved: LessonProgress): LessonProgress {
  return {
    predictions: { ...saved.predictions, ...now.predictions },
    reached: [...new Set([...saved.reached, ...now.reached])],
    hints: { ...saved.hints, ...now.hints },
    visited: [...new Set([...saved.visited, ...now.visited])],
  };
}

function detailsOf(origin: ProgressOrigin): {
  readonly reason: ProgressChangeReason;
  readonly event?: Event;
  readonly source?: ChangeSource;
} {
  return {
    reason: origin.reason,
    ...(origin.event !== undefined && { event: origin.event }),
    ...(origin.source !== undefined && { source: origin.source }),
  };
}

/** The calls the progress primitive offers the parts of an article. Each returns whether the progress changed. */
export type ProgressApi = {
  /** Records the reader's committed prediction. A prediction commits once. */
  readonly commit: (id: string, record: PredictionRecord, origin: ProgressOrigin) => boolean;
  /** Records that the reader reached a challenge. */
  readonly reach: (id: string, origin: ProgressOrigin) => boolean;
  /** Shows one more hint of a challenge. */
  readonly showHint: (id: string, origin: ProgressOrigin) => boolean;
  /** Records that the reader is on a beat. */
  readonly visit: (beat: string, origin: ProgressOrigin) => boolean;
  /** Forgets every prediction, challenge, hint and visit. */
  readonly reset: (origin?: ProgressOrigin) => boolean;
};

/**
 * The reader's progress through an article as one UI SDK primitive named `lesson-progress`. Its controlled key is
 * `progress`, which agents read in the snapshot; agents call none of its actions.
 */
const progressStore = definePrimitive({
  name: 'lesson-progress',
  options: { progress: 'value', defaultProgress: 'value', onProgressChange: 'callback', storageKey: 'string' },
  controlled: ['progress'],
  state: (options: ProgressOptions): ProgressState => ({
    progress: options.progress ?? options.defaultProgress ?? emptyProgress,
  }),
  sync: (options) => (options.progress === undefined ? {} : { progress: options.progress }),
  api: (context) => {
    const change = createChange(context);

    function current(): LessonProgress {
      return context.store.get().progress;
    }

    function update(next: LessonProgress, origin: ProgressOrigin): boolean {
      return change('progress', next, detailsOf(origin));
    }

    return {
      /** Records the reader's committed prediction. A prediction commits once. */
      commit(id: string, record: PredictionRecord, origin: ProgressOrigin): boolean {
        const { predictions } = current();

        return id in predictions
          ? false
          : update({ ...current(), predictions: { ...predictions, [id]: record } }, origin);
      },
      /** Records that the reader reached a challenge. */
      reach(id: string, origin: ProgressOrigin): boolean {
        const { reached } = current();

        return reached.includes(id) ? false : update({ ...current(), reached: [...reached, id] }, origin);
      },
      /** Shows one more hint of a challenge. */
      showHint(id: string, origin: ProgressOrigin): boolean {
        const { hints } = current();

        return update({ ...current(), hints: { ...hints, [id]: (hints[id] ?? 0) + 1 } }, origin);
      },
      /** Records that the reader is on a beat. */
      visit(beat: string, origin: ProgressOrigin): boolean {
        const { visited } = current();

        return visited.includes(beat) ? false : update({ ...current(), visited: [...visited, beat] }, origin);
      },
      /** Forgets every prediction, challenge, hint and visit. */
      reset(origin?: ProgressOrigin): boolean {
        return update(emptyProgress, origin ?? { reason: 'reset' });
      },
      /** Reads the progress saved under the storage key once the article is on the page, then keeps it current. */
      connect(): () => void {
        const { storageKey } = context.options();

        if (storageKey === undefined) {
          return () => undefined;
        }

        const kept = createLocalStorage(storageKey);
        const saved = decodeProgress(kept.get() ?? '');

        if (encodeProgress(saved) !== '') {
          update(mergedProgress(current(), saved), { reason: 'restore' });
        }

        return context.store.subscribe(() => {
          kept.set(encodeProgress(current()));
        });
      },
    };
  },
  slots: (slot) => ({ root: slot({ bind: (_el, part) => part.api.connect() }) }),
  agent: { actions: [] },
});

/**
 * Renders an article element as the root of `lesson-progress`, with props built from the progress and its calls. A
 * change an agent makes is refused before `onProgressChange` hears of it.
 */
export function useProgressRoot(
  options: ProgressOptions,
  props: (progress: LessonProgress, api: ProgressApi) => PartProps<'article'>,
): ReactElement | null {
  const { onProgressChange } = options;

  const handle = usePrimitive(progressStore, {
    ...options,
    onProgressChange: (next, details) => {
      if (details.source === 'agent') {
        details.cancel();

        return;
      }

      onProgressChange?.(next, details);
    },
  });

  useSyncExternalStore(handle.instance.subscribe, handle.instance.get, handle.instance.get);

  return usePart(handle, 'root', {}, props(handle.state.progress, handle.api), 'article');
}
