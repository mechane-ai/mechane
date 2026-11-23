import { useState } from 'react';
import type { ReactNode } from 'react';
import { BarCell, SparkCell } from '../../../charts/src/cells/index.ts';
import { formatValue, MISSING_VALUE_TEXT, ToneScope } from '../../../charts/src/index.ts';
import type { FigureProps, ValueFormat } from '../../../charts/src/index.ts';
import { DataTable, DataTablePlaceholder, DataTableText } from '../../../collections/src/index.ts';
import type { DataTableColumn, DataTableSort } from '../../../collections/src/index.ts';
import { Text } from '../../../core/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { RunMarker } from './run-marker.tsx';
import { RunStateText } from './run-state.tsx';
import { pinnedTones, runsProblem, runStateLabels } from './runs.ts';
import type { RunChangeDetails, RunRecord, RunStateLabels } from './runs.ts';

/** A setting of each run, such as its learning rate or optimizer. */
export type RunColumn = {
  readonly id: string;
  readonly label: string;
  /** The setting's value per run id. A number is written with `format`; a missing run shows as unavailable. */
  readonly values: Readonly<Record<string, string | number | boolean | null>>;
  readonly format?: ValueFormat | undefined;
};

/** A final result of each run, drawn with the graphic that fits it. */
export type RunTableMetric = {
  readonly id: string;
  /** The column heading, with its direction: "Final loss, lower is better". */
  readonly label: string;
  readonly format: ValueFormat;
  /** The scale every row shares. A bar's domain must include zero. */
  readonly domain: readonly [minimum: number, maximum: number];
} & (
  | { readonly kind: 'bar'; readonly values: Readonly<Record<string, number | null>> }
  | { readonly kind: 'spark'; readonly values: Readonly<Record<string, ReadonlyArray<number | null>>> }
);

/** The words in the table. Each has an English default. */
export type RunTableLabels = {
  readonly name: string;
  readonly state: string;
  readonly states: RunStateLabels;
  readonly yes: string;
  readonly no: string;
  readonly empty: string;
  readonly showRun: string;
  readonly focused: string;
};

export type RunTableProps = Pick<FigureProps, 'locale' | 'status'> & {
  /** The table's caption, which names it for assistive technology. */
  readonly title: string;
  readonly runs: ReadonlyArray<RunRecord>;
  readonly columns?: ReadonlyArray<RunColumn> | undefined;
  readonly metrics?: ReadonlyArray<RunTableMetric> | undefined;
  /** Hides the settings every run shares, so only what differs between runs is left. */
  readonly showOnlyDifferences?: boolean | undefined;
  /** The focused run. Pressing a row asks to focus it, or to clear the focus when it is already focused. */
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string | null, details: RunChangeDetails) => void) | undefined;
  /** The runs toggled off. A checked row is a run drawn in the dashboard. */
  readonly hidden?: ReadonlyArray<string> | undefined;
  readonly onHiddenChange?: ((ids: ReadonlyArray<string>, details: RunChangeDetails) => void) | undefined;
  readonly sort?: DataTableSort | null | undefined;
  readonly onSortChange?: ((sort: DataTableSort | undefined) => void) | undefined;
  readonly labels?: Partial<RunTableLabels> | undefined;
};

type SortKey = string | number | null;

const defaultLabels: RunTableLabels = {
  name: 'Run',
  state: 'State',
  states: runStateLabels,
  yes: 'Yes',
  no: 'No',
  empty: 'There are no runs.',
  showRun: 'Show in the charts:',
  focused: 'Focused',
};

const METRIC_WIDTH = 140;
const SETTING_WIDTH = 92;
const STATE_WIDTH = 104;
const NAME_WIDTH = 170;

function settingText({
  column,
  run,
  labels,
  locale,
}: {
  readonly column: RunColumn;
  readonly run: string;
  readonly labels: RunTableLabels;
  readonly locale: string;
}): string {
  const value = column.values[run] ?? null;

  if (typeof value === 'number') {
    return formatValue({ value, locale, format: column.format ?? {} });
  }

  return typeof value === 'boolean' ? (value ? labels.yes : labels.no) : (value ?? MISSING_VALUE_TEXT);
}

function settingKey(value: string | number | boolean | null): SortKey {
  return typeof value === 'boolean' ? Number(value) : value;
}

function metricKey(metric: RunTableMetric, run: string): number | null {
  return metric.kind === 'bar'
    ? (metric.values[run] ?? null)
    : (metric.values[run]?.findLast((point) => point !== null) ?? null);
}

function compareKeys(first: SortKey, second: SortKey): number {
  if (first === null || second === null) {
    return Number(first === null) - Number(second === null);
  }

  return typeof first === 'number' && typeof second === 'number'
    ? first - second
    : String(first).localeCompare(String(second));
}

function tableProblem({
  runs,
  columns,
  metrics,
}: Pick<RunTableProps, 'runs'> & {
  readonly columns: ReadonlyArray<RunColumn>;
  readonly metrics: ReadonlyArray<RunTableMetric>;
}): string | undefined {
  const runIds = new Set(runs.map((run) => run.id));

  const unknown = [...columns.map((column) => column.values), ...metrics.map((metric) => metric.values)]
    .flatMap((values) => Object.keys(values))
    .find((id) => !runIds.has(id));

  const ids = [...columns, ...metrics].map((column) => column.id);

  if (new Set(ids).size !== ids.length) {
    return 'Columns and metrics must have unique identifiers.';
  }

  return unknown === undefined
    ? runsProblem(runs)
    : `A column has values for run ${unknown}, which is not among the runs.`;
}

/**
 * The runs of an experiment as a table that is also the legend: each row carries the run's hue and its state in words.
 * It shows the settings that differ between runs and the final results as bars or tiny curves, and settings every run
 * shares are muted, or hidden with `showOnlyDifferences`. The checkboxes hide runs in a `RunDashboard` and pressing a
 * row focuses a run, while the application supplies the values and holds selection, hiding and sorting.
 */
export function RunTable({
  title,
  locale,
  status,
  runs,
  columns = [],
  metrics = [],
  showOnlyDifferences = false,
  selected = null,
  onSelectedChange,
  hidden = [],
  onHiddenChange,
  sort,
  onSortChange,
  labels: given,
}: RunTableProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const [ownSort, setOwnSort] = useState<DataTableSort>();
  const current = sort === undefined ? ownSort : (sort ?? undefined);
  const problem = tableProblem({ runs, columns, metrics });

  if (problem !== undefined) {
    return <Notice hasError>{`${title}: ${problem}`}</Notice>;
  }

  const shared = new Set(
    columns
      .filter((column) => runs.length > 1 && new Set(runs.map((run) => column.values[run.id] ?? null)).size === 1)
      .map((column) => column.id),
  );

  const keys: Readonly<Record<string, (run: RunRecord) => SortKey>> = {
    name: (run) => run.label,
    state: (run) => labels.states[run.state],
    ...Object.fromEntries(
      columns.map((column) => [column.id, (run: RunRecord): SortKey => settingKey(column.values[run.id] ?? null)]),
    ),
    ...Object.fromEntries(metrics.map((metric) => [metric.id, (run: RunRecord): SortKey => metricKey(metric, run.id)])),
  };

  const rows = runs.toSorted((first, second) => {
    const key = current === undefined ? undefined : keys[current.columnId];
    const order = key === undefined ? 0 : compareKeys(key(first), key(second));

    return current?.direction === 'descending' ? -order : order;
  });

  const layout: ReadonlyArray<DataTableColumn<RunRecord>> = [
    {
      id: 'name',
      label: labels.name,
      role: 'primary',
      width: NAME_WIDTH,
      canSort: true,
      cell: (run) => (
        <DataTableText
          secondary={selected === run.id ? [labels.focused, run.detail].filter(Boolean).join(' · ') : run.detail}
          leading={<RunMarker id={run.id} />}
        >
          {run.label}
        </DataTableText>
      ),
    },
    {
      id: 'state',
      label: labels.state,
      role: 'status',
      width: STATE_WIDTH,
      canSort: true,
      cell: (run) => <RunStateText state={run.state} labels={labels.states} />,
    },
    ...columns
      .filter((column) => !showOnlyDifferences || !shared.has(column.id))
      .map((column) => ({
        id: column.id,
        label: column.label,
        role:
          typeof Object.values(column.values).find((value) => value !== null) === 'number'
            ? ('number' as const)
            : ('text' as const),
        width: SETTING_WIDTH,
        isSecondary: true,
        canSort: true,
        cell: (run: RunRecord) => (
          <Text tone={shared.has(column.id) ? 'muted' : 'ink'}>
            {settingText({ column, run: run.id, labels, locale })}
          </Text>
        ),
      })),
    ...metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      role: 'number' as const,
      width: METRIC_WIDTH,
      canSort: true,
      cell: (run: RunRecord) =>
        metric.kind === 'bar' ? (
          <BarCell
            id={run.id}
            value={metric.values[run.id] ?? null}
            domain={metric.domain}
            locale={locale}
            format={metric.format}
          />
        ) : (
          <SparkCell
            id={run.id}
            points={metric.values[run.id] ?? []}
            domain={metric.domain}
            locale={locale}
            format={metric.format}
          />
        ),
    })),
  ];

  if (status === 'loading') {
    return <DataTablePlaceholder caption={title} columns={layout} rows={runs.length} />;
  }

  return (
    <ToneScope ids={runs.map((run) => run.id)} tones={pinnedTones(runs)}>
      <DataTable
        query={{ mode: 'static', reason: 'A run set is short and the application chooses which runs it holds.' }}
        caption={title}
        rows={rows}
        columns={layout}
        getRowId={(run) => run.id}
        empty={labels.empty}
        sort={current}
        onSortChange={(next) => {
          setOwnSort(next);
          onSortChange?.(next);
        }}
        selectedIds={new Set(runs.filter((run) => !hidden.includes(run.id)).map((run) => run.id))}
        onSelectionChange={(ids, details) =>
          onHiddenChange?.(
            runs.filter((run) => !ids.has(run.id)).map((run) => run.id),
            { reason: details.reason === 'item-press' ? 'press' : 'imperative', event: details.event },
          )
        }
        selectionLabel={(run) => `${labels.showRun} ${run.label}`}
        activeRowId={selected ?? undefined}
        rowAction={{
          label: (run) => run.label,
          onActivate: (run) => onSelectedChange?.(selected === run.id ? null : run.id, { reason: 'press' }),
        }}
      />
    </ToneScope>
  );
}
