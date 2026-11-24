import { createLocalStorage } from '@ui-sdk/core';
import { paramProblem } from './define-lesson.ts';
import type { AnyLesson, LessonParam, LessonValue } from './define-lesson.ts';

/** A full set of param values, by name. */
export type LessonParamValues = Readonly<Record<string, LessonValue>>;

/** How long the values rest before the address bar and storage hear about them, in milliseconds. */
const PERSIST_DELAY_MS = 400;

const toggleTexts: ReadonlyMap<string, boolean> = new Map([
  ['true', true],
  ['false', false],
]);

function decoded(param: LessonParam, text: string): LessonValue {
  switch (param.kind) {
    case 'number':
      return text.trim() === '' ? Number.NaN : Number(text);
    case 'toggle':
      return toggleTexts.get(text) ?? text;
    case 'choice':
      return text;
  }
}

/** The valid values a query text holds for this lesson. Text edited by hand that no param takes is skipped. */
function decodeValues({
  lesson,
  query,
  prefix,
}: {
  readonly lesson: AnyLesson;
  readonly query: URLSearchParams;
  readonly prefix: string;
}): LessonParamValues {
  return Object.fromEntries(
    Object.entries(lesson.params).flatMap(([name, param]) => {
      const text = query.get(`${prefix}${name}`);

      if (text === null) {
        return [];
      }

      const value = decoded(param, text);

      return paramProblem({ name, param, value }) === undefined ? [[name, value] as const] : [];
    }),
  );
}

/** What a caller or an agent hands `setParam`: number text and `"true"` become values, an option's label its id. */
export function coercedValue(param: LessonParam, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (param.kind === 'choice') {
    return param.options.find((option) => option.id === value || option.label === value)?.id ?? value;
  }

  return decoded(param, value);
}

/**
 * Reads the values a reader saved under `storageKey` and the ones the address bar links to, then writes the values back
 * once they rest. The address bar names each value `lessonId.name` and leaves out the ones at their defaults.
 */
export function connectPersistence({
  lesson,
  shouldSyncUrl,
  storageKey,
  read,
  subscribe,
  restore,
}: {
  readonly lesson: AnyLesson;
  readonly shouldSyncUrl: boolean;
  readonly storageKey: string | undefined;
  readonly read: () => LessonParamValues;
  readonly subscribe: (listener: () => void) => () => void;
  readonly restore: (values: LessonParamValues) => void;
}): () => void {
  const prefix = `${lesson.id}.`;
  const kept = storageKey === undefined ? undefined : createLocalStorage(storageKey);
  const linked = shouldSyncUrl ? new URLSearchParams(location.search) : new URLSearchParams();

  restore({
    ...decodeValues({ lesson, query: new URLSearchParams(kept?.get() ?? ''), prefix: '' }),
    ...decodeValues({ lesson, query: linked, prefix }),
  });

  const timer: { id: ReturnType<typeof setTimeout> | undefined; written: LessonParamValues } = {
    id: undefined,
    written: read(),
  };

  function persist(): void {
    const values = read();

    timer.written = values;

    kept?.set(new URLSearchParams(Object.entries(values).map(([name, value]) => [name, String(value)])).toString());

    if (!shouldSyncUrl) {
      return;
    }

    const ours = new Set(Object.keys(values).map((name) => `${prefix}${name}`));

    const query = new URLSearchParams([
      ...[...new URLSearchParams(location.search)].filter(([key]) => !ours.has(key)),
      ...Object.entries(values)
        .filter(([name, value]) => value !== lesson.defaults[name])
        .map(([name, value]) => [`${prefix}${name}`, String(value)]),
    ]);

    const search = query.toString();

    history.replaceState(history.state, '', `${location.pathname}${search === '' ? '' : `?${search}`}${location.hash}`);
  }

  const unsubscribe = subscribe(() => {
    if (read() !== timer.written) {
      globalThis.clearTimeout(timer.id);

      timer.id = globalThis.setTimeout(persist, PERSIST_DELAY_MS);
    }
  });

  return () => {
    unsubscribe();
    globalThis.clearTimeout(timer.id);
  };
}
