import type { ReactNode } from 'react';
import { ChartSeriesMarker, formatValue, ToneScope, useScopedTone } from '../../../charts/src/index.ts';
import type { FigureProps } from '../../../charts/src/index.ts';
// Deep import: the shared figure frame is not exported from the charts index yet.
import { FigureFrame, FigureInvalid } from '../../../charts/src/plot/index.ts';
import { DataTable, DataTablePlaceholder, DataTableText } from '../../../collections/src/index.ts';
import type {
  DataTableColumn,
  DataTableColumnLayout,
  DataTableSelectionDetails,
  DataTableSort,
  DataTableSortDetails,
} from '../../../collections/src/index.ts';
import { repeatedId, useLinkedRows } from './evaluation-data.ts';
import type { EvaluationModel } from './evaluation-data.ts';
import { columnWidths, MeasureCell, rankedValue, valueKindProblem } from './leaderboard-cells.tsx';
import type { LeaderboardColumn, LeaderboardValue } from './leaderboard-cells.tsx';

/** One model's results: its values by column id. A column left out reads as not measured. */
export type LeaderboardRow = {
  /** The id of a model in `models`. */
  readonly model: string;
  /** The model's place as the application ranked it. Ties may share a rank. */
  readonly rank?: number | undefined;
  readonly values: Readonly<Record<string, LeaderboardValue>>;
};

/** The words the leaderboard shows that are not data. */
export type LeaderboardLabels = {
  readonly model: string;
  readonly rank: string;
  /** Heard by a screen reader after the best value of a column. */
  readonly best: string;
  readonly bestNote: string;
  readonly higherIsBetter: string;
  readonly lowerIsBetter: string;
  /** Starts the name of a row's checkbox: "Select Atlas 13B". */
  readonly select: string;
};

export type LeaderboardProps = FigureProps & {
  /**
   * Every model the page shows, in the order their hues are assigned. The table keeps one tone scope over them, so a
   * figure under a `ToneScope` with the same ids shows each model in the same hue.
   */
  readonly models: ReadonlyArray<EvaluationModel>;
  readonly columns: ReadonlyArray<LeaderboardColumn>;
  /** One row per model with results, in the application's order. */
  readonly rows: ReadonlyArray<LeaderboardRow>;
  /**
   * The column the rows are ordered by. Absent keeps the order given, which is the rank order. Missing values sort
   * last.
   */
  readonly sort?: DataTableSort | undefined;
  /** Hears a press on a sortable header. Without it the headers do not sort. */
  readonly onSortChange?: ((sort: DataTableSort | undefined, details: DataTableSortDetails) => void) | undefined;
  /** The ids of the checked models. */
  readonly selected?: ReadonlyArray<string> | undefined;
  /** Hears a press on a row's checkbox. Without it the rows have no checkboxes. */
  readonly onSelectedChange?:
    | ((selected: ReadonlyArray<string>, details: DataTableSelectionDetails) => void)
    | undefined;
  readonly labels?: Partial<LeaderboardLabels> | undefined;
  /** Show the generated direction/bolding footnote below the table. Defaults to false. */
  readonly showLegendNote?: boolean | undefined;
};

/** The most models and measure columns a leaderboard shows. Larger input is refused. */
export const leaderboardLimits = { models: 100, columns: 10 } as const;

const defaultLabels: LeaderboardLabels = {
  model: 'Model',
  rank: 'Rank',
  best: ', best in column',
  bestNote: 'Bold marks the best value in each column.',
  higherIsBetter: 'Higher is better',
  lowerIsBetter: 'Lower is better',
  select: 'Select',
};

const reservedColumns: ReadonlySet<string> = new Set(['model', 'rank']);
const RANK_WIDTH = 80;
const PLACEHOLDER_ROWS = 5;
const rankFormat = { maximumFractionDigits: 0 } as const;

function leaderboardProblem({ models, columns, rows }: LeaderboardProps): string | undefined {
  const modelIds = new Set(models.map((model) => model.id));
  const columnIds = new Set(columns.map((column) => column.id));

  const repeated =
    repeatedId(models.map((model) => model.id)) ??
    repeatedId(columns.map((column) => column.id)) ??
    repeatedId(rows.map((row) => row.model));

  if (repeated !== undefined) {
    return `The id ${repeated} appears twice. Models, columns and rows need unique ids.`;
  }

  if (rows.length > leaderboardLimits.models || columns.length > leaderboardLimits.columns) {
    return `A leaderboard shows at most ${leaderboardLimits.models} models and ${leaderboardLimits.columns} columns.`;
  }

  const reserved = columns.find((column) => reservedColumns.has(column.id));

  if (reserved !== undefined) {
    return `The column id ${reserved.id} is reserved for the leaderboard's own column.`;
  }

  const unknownModel = rows.find((row) => !modelIds.has(row.model));

  if (unknownModel !== undefined) {
    return `Row ${unknownModel.model} names a model that is not listed.`;
  }

  const unknownColumn = rows.flatMap((row) => Object.keys(row.values)).find((id) => !columnIds.has(id));

  if (unknownColumn !== undefined) {
    return `A row has a value for column ${unknownColumn}, which is not listed.`;
  }

  return rows
    .flatMap((row) => columns.map((column) => valueKindProblem(column, row.values[column.id] ?? null)))
    .find((problem) => problem !== undefined);
}

function ordered({
  rows,
  sort,
  models,
  locale,
}: Pick<LeaderboardProps, 'rows' | 'sort' | 'models' | 'locale'>): ReadonlyArray<LeaderboardRow> {
  if (sort === undefined) {
    return rows;
  }

  const direction = sort.direction === 'ascending' ? 1 : -1;
  const names = new Map(models.map((model) => [model.id, model.label]));

  if (sort.columnId === 'model') {
    return rows.toSorted(
      (first, second) =>
        direction * (names.get(first.model) ?? '').localeCompare(names.get(second.model) ?? '', locale),
    );
  }

  function key(row: LeaderboardRow): number | null {
    return rankedValue(row.values[sort?.columnId ?? ''] ?? null);
  }

  return rows.toSorted((first, second) => {
    const [left, right] = [key(first), key(second)];

    if (left === null || right === null) {
      return (left === null ? 1 : 0) - (right === null ? 1 : 0);
    }

    return direction * (left - right);
  });
}

function ModelName({ model }: { readonly model: EvaluationModel }): ReactNode {
  const tone = useScopedTone(model.id) ?? 'neutral';

  return (
    <DataTableText secondary={model.detail} leading={<ChartSeriesMarker tone={tone} />}>
      {model.label}
    </DataTableText>
  );
}

/**
 * A ranked table of models over benchmarks, as an evaluation paper or dashboard shows it, where the application owns
 * the order, the sort and the checked models. Each measure column draws its values with a table cell graphic on one
 * shared scale and writes the exact value beside it. The best value of each column is set in bold and named for screen
 * readers, and inside a `ChartLink`, resting on a row marks it in the linked figures.
 */
export function Leaderboard(props: LeaderboardProps): ReactNode {
  const {
    models,
    columns,
    rows,
    sort,
    onSortChange,
    selected,
    onSelectedChange,
    labels: custom,
    showLegendNote = false,
    ...figure
  } = props;

  const { emptyLabel = 'No models have results yet.', ...frame } = figure;
  const labels = { ...defaultLabels, ...custom };
  const onRowHighlightChange = useLinkedRows(rows.map((row) => row.model));
  const hasRank = rows.some((row) => row.rank !== undefined);

  const layout: ReadonlyArray<DataTableColumnLayout> = [
    ...(hasRank ? [{ id: 'rank', label: labels.rank, role: 'number' as const, width: RANK_WIDTH }] : []),
    { id: 'model', label: labels.model, role: 'primary' },
    ...columns.map((column) => ({
      id: column.id,
      label: column.label,
      role: 'number' as const,
      width: column.width ?? columnWidths[column.kind],
      ...(column.isSecondary === true && { isSecondary: true }),
    })),
  ];

  if (frame.status === 'loading') {
    return (
      <FigureFrame {...frame}>
        <DataTablePlaceholder caption={frame.title} columns={layout} rows={PLACEHOLDER_ROWS} />
      </FigureFrame>
    );
  }

  const problem = leaderboardProblem(props);

  if (problem !== undefined) {
    return <FigureInvalid {...frame} message={problem} />;
  }

  const modelsById = new Map(models.map((model) => [model.id, model]));

  const best = new Map(
    columns.map((column) => {
      const values = rows.flatMap((row) => rankedValue(row.values[column.id] ?? null) ?? []);
      const pick = column.isHigherBetter ? Math.max(...values) : Math.min(...values);

      return [column.id, values.length < 2 ? undefined : pick];
    }),
  );

  const cells: ReadonlyArray<DataTableColumn<LeaderboardRow>> = layout.map((column) => ({
    ...column,
    cell: (row: LeaderboardRow) => {
      const model = modelsById.get(row.model) ?? { id: row.model, label: row.model };
      const measure = columns.find((candidate) => candidate.id === column.id);

      if (measure === undefined) {
        return column.id === 'rank' ? (
          formatValue({ value: row.rank ?? null, locale: frame.locale, format: rankFormat })
        ) : (
          <ModelName model={model} />
        );
      }

      const value = row.values[measure.id] ?? null;

      return (
        <MeasureCell
          column={measure}
          value={value}
          model={row.model}
          locale={frame.locale}
          isBest={rankedValue(value) !== null && rankedValue(value) === best.get(measure.id)}
          bestLabel={labels.best}
        />
      );
    },
  }));

  const higher = columns.filter((column) => column.isHigherBetter).map((column) => column.label);
  const lower = columns.filter((column) => !column.isHigherBetter).map((column) => column.label);

  const note = [
    ...(higher.length > 0 ? [`${labels.higherIsBetter}: ${higher.join(', ')}.`] : []),
    ...(lower.length > 0 ? [`${labels.lowerIsBetter}: ${lower.join(', ')}.`] : []),
    labels.bestNote,
  ].join(' ');

  const table = {
    query: { mode: 'static', reason: 'The leaderboard shows every model it is given.' } as const,
    rows: ordered({ rows, sort, models, locale: frame.locale }),
    getRowId: (row: LeaderboardRow) => row.model,
    caption: frame.title,
    hideCaption: true,
    empty: emptyLabel,
    onRowHighlightChange,
  };

  const selection =
    onSelectedChange === undefined
      ? {}
      : {
          selectedIds: new Set(selected),
          onSelectionChange: (ids: ReadonlySet<string>, details: DataTableSelectionDetails) =>
            onSelectedChange(Array.from(ids), details),
          selectionLabel: (row: LeaderboardRow) => `${labels.select} ${modelsById.get(row.model)?.label ?? row.model}`,
        };

  return (
    <ToneScope
      ids={models.map((model) => model.id)}
      tones={Object.fromEntries(models.flatMap((model) => (model.tone === undefined ? [] : [[model.id, model.tone]])))}
    >
      <FigureFrame {...frame} footer={showLegendNote ? note : undefined}>
        {onSortChange === undefined ? (
          <DataTable
            {...table}
            {...selection}
            columns={cells.map((column) => ({ ...column, canSort: false as const }))}
          />
        ) : (
          <DataTable
            {...table}
            {...selection}
            columns={cells.map((column) => ({ ...column, canSort: column.id !== 'rank' }))}
            sort={sort}
            onSortChange={onSortChange}
          />
        )}
      </FigureFrame>
    </ToneScope>
  );
}
