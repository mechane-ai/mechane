import { formatNumber } from '@ui-sdk/core/number';
import { coverageText } from '../figure/figure-frame.tsx';
import type { FigureCoverage } from '../figure/figure-props.ts';
import { sum } from '../transforms/values.ts';
import type { FigureSpec } from './figure-spec.ts';

/** Props that frame a figure rather than hold its records, so a count of records leaves them out. */
const framingKeys: ReadonlySet<string> = new Set([
  'title',
  'description',
  'locale',
  'source',
  'coverage',
  'transforms',
  'report',
  'status',
  'emptyLabel',
  'selected',
  'highlighted',
  'pinned',
  'emphasizedCategoryIds',
]);

/** Words that stay as written in a chart's name, such as an initialism. */
const INITIALISM = /^[A-Z]{2,}$/u;
const NAME_WORDS = /[A-Z]+(?![a-z])|[A-Z][a-z]*|[a-z]+|\d+/gu;
const PLURAL_IES = /ies$/u;
const PLURAL_S = /(?<!s)s$/u;
const DOMAIN_KEY = /domain$/iu;

type RecordCount = { readonly noun: string; readonly count: number };

/** "CurveChart" as words: "curve chart"; "ECDF" stays "ECDF". */
function chartWords(chart: string): string {
  return (chart.match(NAME_WORDS) ?? [chart])
    .map((word) => (INITIALISM.test(word) ? word : word.toLowerCase()))
    .join(' ');
}

function entriesOf(value: unknown): ReadonlyArray<readonly [string, unknown]> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? [...new Map<string, unknown>(Object.entries(value))]
    : [];
}

/** The records one top-level prop holds: an array and the arrays inside its items, or the arrays of an object. */
function propCounts(key: string, value: unknown): ReadonlyArray<RecordCount> {
  if (Array.isArray(value)) {
    const nested = value.flatMap((item: unknown) =>
      entriesOf(item).flatMap(([itemKey, itemValue]) =>
        Array.isArray(itemValue) && !DOMAIN_KEY.test(itemKey) ? [{ noun: itemKey, count: itemValue.length }] : [],
      ),
    );

    const nouns = [...new Set(nested.map(({ noun }) => noun))];

    return [
      { noun: key, count: value.length },
      ...nouns.map((noun) => ({
        noun,
        count: sum(nested.filter((item) => item.noun === noun).map((item) => item.count)),
      })),
    ];
  }

  const arrays = entriesOf(value).flatMap(([itemKey, itemValue]) =>
    Array.isArray(itemValue) && !DOMAIN_KEY.test(itemKey) ? [{ noun: itemKey, count: itemValue.length }] : [],
  );

  const lengths = new Set(arrays.map(({ count }) => count));
  const [only] = lengths;

  if (arrays.length > 1 && lengths.size === 1 && only !== undefined) {
    return [{ noun: key, count: only }];
  }

  return arrays;
}

function singular(noun: string): string {
  if (noun === 'series') {
    return noun;
  }

  return noun.endsWith('ies') ? noun.replace(PLURAL_IES, 'y') : noun.replace(PLURAL_S, '');
}

function countText({ noun, count }: RecordCount, locale: string | undefined): string {
  const number = locale === undefined ? String(count) : formatNumber(count, locale, {});

  return `${number} ${count === 1 ? singular(noun) : noun}`;
}

function sentence(text: string): string {
  return /[.!?]$/u.test(text) ? text : `${text}.`;
}

function textProp(props: ReadonlyMap<string, unknown>, key: string): string | undefined {
  const value = props.get(key);

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function coverageOf(value: unknown): FigureCoverage | undefined {
  const fields = new Map(entriesOf(value));
  const shown = fields.get('shown');
  const total = fields.get('total');
  const unit = fields.get('unit');

  return typeof shown === 'number' && typeof total === 'number' && typeof unit === 'string'
    ? { shown, total, unit }
    : undefined;
}

/**
 * A short plain-text account of a figure for places that cannot draw it: a chat transcript, a log, a screen reader
 * summary or an agent reading its results back. It names the chart, its title and description, the source, how much of
 * the data is drawn, the transforms and how many records it holds ("3 series, 120 points"). It does not restate the
 * values.
 */
export function describeFigure(spec: FigureSpec): string {
  const props = new Map<string, unknown>(Object.entries(spec.props));
  const locale = textProp(props, 'locale');
  const title = textProp(props, 'title');
  const description = textProp(props, 'description');
  const source = textProp(props, 'source');
  const coverage = coverageOf(props.get('coverage'));
  const transformList = props.get('transforms');

  const transforms = Array.isArray(transformList)
    ? transformList.filter((item: unknown) => typeof item === 'string')
    : [];

  const counts = [...props]
    .filter(([key]) => !framingKeys.has(key) && !DOMAIN_KEY.test(key))
    .flatMap(([key, value]) => propCounts(key, value))
    .map((count) => countText(count, locale));

  const kind = chartWords(spec.chart);
  const article = /^[aeiou]/iu.test(kind) ? 'An' : 'A';
  const named = title === undefined ? `${article} ${kind}` : `${article} ${kind}, "${title}"`;

  const lines = [
    counts.length > 0 ? `${named}, with ${counts.join(', ')}.` : `${named}.`,
    description === undefined ? undefined : sentence(description),
    coverage === undefined || locale === undefined ? undefined : sentence(coverageText(coverage, locale)),
    source === undefined ? undefined : sentence(`Source: ${source}`),
    transforms.length > 0 ? sentence(`Transforms: ${transforms.join('; ')}`) : undefined,
  ];

  return lines.filter((line) => line !== undefined).join(' ');
}
