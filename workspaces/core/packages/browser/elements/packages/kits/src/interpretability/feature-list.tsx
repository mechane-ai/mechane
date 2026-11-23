import type { ReactNode } from 'react';
import { BarCell, SparkCell } from '../../../charts/src/cells/index.ts';
import { formatValue } from '../../../charts/src/index.ts';
import type { FigureStatus, NumericDomain, ValueFormat } from '../../../charts/src/index.ts';
import { DataTable, DataTablePlaceholder, DataTableText } from '../../../collections/src/index.ts';
import type { DataTableColumn, DataTableSort } from '../../../collections/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { featureLimits, matchesQuery, repeatedFeatureId, useFeatureHighlight } from './features.ts';
import type { FeatureSummary, InterpretabilityChangeDetails } from './features.ts';

/** One row of the list: a feature with the measures the application computed for it. */
export type FeatureListRow = FeatureSummary & {
  /** The largest activation seen, or null where it was not measured. */
  readonly maxActivation?: number | null | undefined;
  /** The feature's activation at each layer, in `layers` order, for a tiny curve. */
  readonly profile?: ReadonlyArray<number | null> | undefined;
};

/** The words in the list. Each has an English default. */
export type FeatureListLabels = {
  readonly feature: string;
  readonly frequency: string;
  readonly maxActivation: string;
  readonly profile: string;
  readonly search: string;
  readonly searchPlaceholder: string;
  readonly empty: string;
  readonly noMatches: string;
};

export type FeatureListProps = {
  /** The table's caption, which names it for assistive technology. */
  readonly title: string;
  readonly locale: string;
  readonly status?: FigureStatus | undefined;
  readonly features: ReadonlyArray<FeatureListRow>;
  /** The scale every frequency bar shares. It starts at zero. */
  readonly frequencyDomain: NumericDomain;
  readonly frequencyFormat: ValueFormat;
  readonly activationFormat: ValueFormat;
  /** The scale every layer profile shares. Leave it out, with the profiles, to drop the column. */
  readonly profileDomain?: NumericDomain | undefined;
  /** The feature the reader opened. Pressing a row asks to open it. */
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string, details: InterpretabilityChangeDetails) => void) | undefined;
  /** The search text. The list shows the features whose label, id or explanation contains it. */
  readonly query?: string | undefined;
  readonly onQueryChange?: ((query: string, details: InterpretabilityChangeDetails) => void) | undefined;
  readonly sort?: DataTableSort | undefined;
  readonly onSortChange?: ((sort: DataTableSort | undefined) => void) | undefined;
  readonly labels?: Partial<FeatureListLabels> | undefined;
};

type SortValue = string | number | null;

const NAME_WIDTH = 240;
const BAR_WIDTH = 150;
const NUMBER_WIDTH = 120;
const SPARK_WIDTH = 150;

const defaultLabels: FeatureListLabels = {
  feature: 'Feature',
  frequency: 'Frequency',
  maxActivation: 'Max activation',
  profile: 'Activation by layer',
  search: 'Find a feature',
  searchPlaceholder: 'Name, id or explanation',
  empty: 'There are no features.',
  noMatches: 'No feature matches the search.',
};

function sortValue(row: FeatureListRow, column: string): SortValue {
  switch (column) {
    case 'frequency':
      return row.frequency ?? null;
    case 'max':
      return row.maxActivation ?? null;
    default:
      return row.label;
  }
}

function byColumn(sort: DataTableSort): (first: FeatureListRow, second: FeatureListRow) => number {
  const sign = sort.direction === 'descending' ? -1 : 1;

  return (first, second) => {
    const [left, right] = [sortValue(first, sort.columnId), sortValue(second, sort.columnId)];

    if (left === null || right === null) {
      return Number(left === null) - Number(right === null);
    }

    return (
      sign *
      (typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right)))
    );
  };
}

/**
 * Many features as a sortable, searchable table, as a feature browser lists a dictionary, where the application holds
 * the open feature, search text and sort, and supplies every measure. Each row names the feature and shows how often it
 * fires as a bar, its largest activation and, when supplied, a tiny curve of its activation by layer. Pressing a row
 * opens the feature, and resting on a row lights it in linked figures.
 */
export function FeatureList({
  title,
  locale,
  status,
  features,
  frequencyDomain,
  frequencyFormat,
  activationFormat,
  profileDomain,
  selected = null,
  onSelectedChange,
  query = '',
  onQueryChange,
  sort,
  onSortChange,
  labels: given,
}: FeatureListProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const highlight = useFeatureHighlight(features.map((feature) => feature.id));
  const repeated = repeatedFeatureId(features.map((feature) => feature.id));

  if (repeated !== undefined || features.length > featureLimits.features) {
    const problem =
      repeated === undefined
        ? `This list shows at most ${featureLimits.features} features. Supply a page of them.`
        : `Feature ${repeated} appears twice. Features must have unique identifiers.`;

    return <Notice hasError>{`${title}: ${problem}`}</Notice>;
  }

  const hasProfile = profileDomain !== undefined && features.some((feature) => feature.profile !== undefined);
  const shown = features.filter((feature) => matchesQuery(feature, query));
  const rows = sort === undefined ? shown : shown.toSorted(byColumn(sort));

  const columns: ReadonlyArray<DataTableColumn<FeatureListRow>> = [
    {
      id: 'label',
      label: labels.feature,
      role: 'primary',
      width: NAME_WIDTH,
      canSort: true,
      cell: (feature) => (
        <DataTableText secondary={[feature.id, feature.source].filter(Boolean).join(' · ')}>
          {feature.label}
        </DataTableText>
      ),
    },
    {
      id: 'frequency',
      label: labels.frequency,
      role: 'number',
      width: BAR_WIDTH,
      canSort: true,
      cell: (feature) => (
        <BarCell
          id={feature.id}
          tone="series1"
          value={feature.frequency ?? null}
          domain={frequencyDomain}
          locale={locale}
          format={frequencyFormat}
        />
      ),
    },
    {
      id: 'max',
      label: labels.maxActivation,
      role: 'number',
      width: NUMBER_WIDTH,
      canSort: true,
      isSecondary: true,
      cell: (feature) => formatValue({ value: feature.maxActivation ?? null, locale, format: activationFormat }),
    },
    ...(hasProfile
      ? [
          {
            id: 'profile',
            label: labels.profile,
            role: 'number' as const,
            width: SPARK_WIDTH,
            isSecondary: true,
            cell: (feature: FeatureListRow) => (
              <SparkCell
                id={feature.id}
                tone="series1"
                points={feature.profile ?? []}
                domain={profileDomain}
                locale={locale}
                format={activationFormat}
              />
            ),
          },
        ]
      : []),
  ];

  if (status === 'loading') {
    return <DataTablePlaceholder caption={title} columns={columns} rows={6} />;
  }

  return (
    <DataTable
      query={{
        mode: 'controlled',
        search: {
          value: query,
          label: labels.search,
          placeholder: labels.searchPlaceholder,
          onChange: (value, details) => onQueryChange?.(value, { reason: 'input', event: details.event }),
        },
        filters: { reason: 'Features are found by search; the application pages large dictionaries.' },
      }}
      caption={title}
      rows={rows}
      columns={columns}
      getRowId={(feature) => feature.id}
      empty={labels.empty}
      filteredEmpty={labels.noMatches}
      sort={sort}
      onSortChange={(next) => onSortChange?.(next)}
      activeRowId={selected ?? undefined}
      onRowHighlightChange={highlight}
      rowAction={{
        label: (feature) => feature.label,
        onActivate: (feature) => onSelectedChange?.(feature.id, { reason: 'press' }),
      }}
    />
  );
}
