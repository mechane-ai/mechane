const NOTE_DIGITS = 3;

/** Why a transform could not use its input, in a sentence the application can show or log. */
export type TransformInvalid = { readonly kind: 'invalid'; readonly message: string };

/** What a transform returns when its input may be unusable: its result, or the reason it could not compute one. */
export type TransformResult<T> = ({ readonly kind: 'ok' } & T) | TransformInvalid;

/** One observation of an ordered series. A `y` of null is a gap: the series has no value there. */
export type SeriesPoint = { readonly x: number; readonly y: number | null };

/** A point with a value: an observation a fit, a smoother or a sampler can use. */
export type ObservedPoint = { readonly x: number; readonly y: number };

/** The successful case of a transform's result, for helpers such as the `describe…` footnotes that read it. */
export type TransformOk<R> = Extract<R, { readonly kind: 'ok' }>;

/** The reason a transform rejected its input. */
export function invalid(message: string): TransformInvalid {
  return { kind: 'invalid', message };
}

/** A finite number as it is, and null for a missing one. Null, NaN and infinities are missing to every transform. */
export function finiteOrNull(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

/** The finite numbers of a list, in their order. Missing entries are dropped, never read as zero. */
export function observedValues(values: ReadonlyArray<number | null>): ReadonlyArray<number> {
  return values.flatMap((value) => (value !== null && Number.isFinite(value) ? [value] : []));
}

/** The finite numbers of a list from smallest to largest. */
export function sortedValues(values: ReadonlyArray<number | null>): ReadonlyArray<number> {
  return observedValues(values).toSorted((left, right) => left - right);
}

/** The points of a series whose x and y are both finite, in their order. */
export function observedPoints(points: ReadonlyArray<SeriesPoint>): ReadonlyArray<ObservedPoint> {
  return points.flatMap((point) =>
    point.y !== null && Number.isFinite(point.x) && Number.isFinite(point.y) ? [{ x: point.x, y: point.y }] : [],
  );
}

export type ScanInput<T, S> = {
  readonly items: ReadonlyArray<T>;
  readonly initial: S;
  readonly step: (state: S, item: T, index: number) => S;
};

/** Every intermediate state of a left-to-right pass over a list: the running form of a fold. */
export function scan<T, S>({ items, initial, step }: ScanInput<T, S>): ReadonlyArray<S> {
  const running = { state: initial };

  return items.map((item, index) => {
    running.state = step(running.state, item, index);

    return running.state;
  });
}

/** The total of a list; zero for an empty one. */
export function sum(values: ReadonlyArray<number>): number {
  return scan({ items: values, initial: 0, step: (total, value) => total + value }).at(-1) ?? 0;
}

/** The arithmetic mean of a list that has at least one value. */
export function mean(values: ReadonlyArray<number>): number {
  return sum(values) / values.length;
}

/** The sum of squared distances from the mean. */
export function squaredDeviation(values: ReadonlyArray<number>): number {
  const center = mean(values);

  return sum(values.map((value) => (value - center) * (value - center)));
}

/** How often each index from 0 to `size - 1` occurs in a list. */
export function tally(indices: ReadonlyArray<number>, size: number): ReadonlyArray<number> {
  const groups = Map.groupBy(indices, (index) => index);

  return Array.from({ length: size }, (_, index) => groups.get(index)?.length ?? 0);
}

/** True for a whole number from `low` to `high`. */
export function isCount(value: number, bounds: readonly [low: number, high: number]): boolean {
  return Number.isInteger(value) && value >= bounds[0] && value <= bounds[1];
}

/** True when every id in a list is different. */
export function hasDistinctIds(ids: ReadonlyArray<string>): boolean {
  return new Set(ids).size === ids.length;
}

/** The distinct values of a list in increasing order. */
export function distinctSorted(values: ReadonlyArray<number>): ReadonlyArray<number> {
  const sorted = values.toSorted((left, right) => left - right);

  return sorted.filter((value, index) => index === 0 || sorted[index - 1] !== value);
}

/** A number as a footnote writes it in the reader's locale: whole in full, others to three significant digits. */
export function noteNumber(value: number, locale: string): string {
  const format = Number.isInteger(value) ? {} : { maximumSignificantDigits: NOTE_DIGITS };

  return new Intl.NumberFormat(locale, format).format(value);
}

/** The singular and plural names of what a note counts. */
export type NoteNoun = { readonly one: string; readonly other: string };

const missingNoun = { one: 'missing value', other: 'missing values' } as const satisfies NoteNoun;

/** A sentence that counts the entries a transform left out, or nothing when it left none out. */
export function leftOutNote({
  count,
  noun = missingNoun,
  reason = 'skipped',
  locale,
}: {
  readonly count: number;
  /** What was left out. Defaults to missing values. */
  readonly noun?: NoteNoun | undefined;
  /** What happened to them. Defaults to "skipped". */
  readonly reason?: string | undefined;
  readonly locale: string;
}): string {
  if (count === 0) {
    return '';
  }

  return ` ${noteNumber(count, locale)} ${count === 1 ? noun.one : noun.other} ${reason}.`;
}
