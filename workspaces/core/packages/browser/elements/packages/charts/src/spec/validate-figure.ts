import { figureRegistry } from './figure-registry.tsx';
import type { JsonKind } from './figure-registry.tsx';
import type { FigureSpec } from './figure-spec.ts';

/** The outcome of checking a figure spec: the spec, typed, or the first reason it cannot be drawn. */
export type FigureSpecResult =
  | { readonly kind: 'ok'; readonly spec: FigureSpec }
  | { readonly kind: 'invalid'; readonly message: string };

type ValueKind = JsonKind | 'null' | 'undefined' | 'function' | 'other';

const NOT_A_SPEC = 'A figure spec is an object with `chart` and `props`.';
const suggestion = { count: 3, pair: 2, likenessMin: 0.5 } as const;
const vowelKinds: ReadonlySet<ValueKind> = new Set(['array', 'object', 'undefined', 'other']);

function kindOf(value: unknown): ValueKind {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    case 'undefined':
      return 'undefined';
    case 'function':
      return 'function';
    case 'bigint':
    case 'symbol':
      return 'other';
  }

  return 'other';
}

function article(kind: ValueKind): string {
  return `${vowelKinds.has(kind) ? 'an' : 'a'} ${kind}`;
}

function registeredEntry(name: string): (typeof figureRegistry)[keyof typeof figureRegistry] | undefined {
  return Object.values(figureRegistry).find((entry) => entry.chart === name);
}

/** The pairs of adjacent letters in a name, the unit two names are compared by. */
function letterPairs(name: string): ReadonlyArray<string> {
  return Array.from({ length: Math.max(name.length - 1, 0) }, (_, index) => name.slice(index, index + suggestion.pair));
}

/** How alike two names are, from 0 to 1: twice the shared letter pairs over all pairs. */
function likeness(left: string, right: string): number {
  const leftPairs = letterPairs(left);
  const rightPairs = new Set(letterPairs(right));
  const shared = leftPairs.filter((pair) => rightPairs.has(pair)).length;
  const total = leftPairs.length + rightPairs.size;

  return total === 0 ? 0 : (suggestion.pair * shared) / total;
}

/** Registered chart names close to a name that is not registered, closest first. */
function closeNames(name: string): ReadonlyArray<string> {
  const wanted = name.toLowerCase();

  return Object.values(figureRegistry)
    .map(({ chart }) => {
      const known = chart.toLowerCase();
      const isPart = wanted.length > 0 && (known.includes(wanted) || wanted.includes(known));

      return { chart, score: isPart ? 1 : likeness(wanted, known) };
    })
    .filter(({ score }) => score >= suggestion.likenessMin)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, suggestion.count)
    .map(({ chart }) => chart);
}

function childrenOf(value: unknown): ReadonlyArray<unknown> {
  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === 'object' && value !== null
    ? [...new Map<string, unknown>(Object.entries(value)).values()]
    : [];
}

/**
 * Every value inside a JSON-like value, level by level. An object met twice is walked once, so a cycle ends.
 *
 * @yields The value, then everything nested in it.
 */
function* nested(input: unknown): Generator {
  const seen = new Set();
  const level: { values: ReadonlyArray<unknown> } = { values: [input] };

  while (level.values.length > 0) {
    yield* level.values;

    level.values = level.values.flatMap((value) => {
      if (typeof value !== 'object' || value === null || seen.has(value)) {
        return [];
      }

      seen.add(value);

      return childrenOf(value);
    });
  }
}

function propsProblem(chart: string, required: Readonly<Record<string, JsonKind>>, props: unknown): string | undefined {
  if (typeof props !== 'object' || props === null || Array.isArray(props)) {
    return `${chart} needs \`props\` as an object, not ${article(kindOf(props))}.`;
  }

  const values = new Map<string, unknown>(Object.entries(props));

  for (const [key, kind] of Object.entries(required)) {
    const actual = kindOf(values.get(key));

    if (actual === 'undefined') {
      return `${chart} needs the prop \`${key}\` (${article(kind)}).`;
    }

    if (actual !== kind) {
      return `${chart} needs \`${key}\` as ${article(kind)}, not ${article(actual)}.`;
    }
  }

  if ([...nested(props)].some((value) => typeof value === 'function')) {
    return 'A figure spec is plain JSON, and its props hold a function. Pass callbacks to Figure beside the spec.';
  }

  const locale = values.get('locale');

  if (values.has('locale') && (typeof locale !== 'string' || locale.trim().length === 0)) {
    return `${chart} needs \`locale\` as a non-empty string, such as "en-US".`;
  }

  return undefined;
}

/** The first reason an input is not a figure spec `Figure` can hand to its chart, or undefined when it is one. */
function figureSpecProblem(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return NOT_A_SPEC;
  }

  const fields = new Map<string, unknown>(Object.entries(input));
  const chart = fields.get('chart');

  if (typeof chart !== 'string') {
    return 'A figure spec needs `chart`, the name of a registered chart, as a string.';
  }

  const entry = registeredEntry(chart);

  if (entry === undefined) {
    const close = closeNames(chart);
    const hint = close.length > 0 ? ` Did you mean ${close.join(', ')}?` : '';

    return `"${chart}" is not a registered chart.${hint}`;
  }

  return propsProblem(chart, entry.required, fields.get('props'));
}

/**
 * Whether an input is a figure spec, given what `figureSpecProblem` said of it. The check is structural, so the spec's
 * deeper values stay each chart's to check.
 */
// TypeScript cannot carry a structural check made at run time onto the union of every chart's props.
// ast-grep-ignore: type-predicate
function isFigureSpec(input: unknown, problem: string | undefined): input is FigureSpec {
  return problem === undefined && typeof input === 'object' && input !== null;
}

/**
 * Checks a figure spec from an agent, a server or a file before it is drawn. The check is structural: an object, a
 * registered `chart`, `props` with every required prop of the right JSON kind, no functions anywhere and a non-empty
 * `locale`. Each chart checks its values itself and shows an invalid state with the reason.
 */
export function validateFigureSpec(input: unknown): FigureSpecResult {
  const message = figureSpecProblem(input);

  return isFigureSpec(input, message)
    ? { kind: 'ok', spec: input }
    : { kind: 'invalid', message: message ?? NOT_A_SPEC };
}
