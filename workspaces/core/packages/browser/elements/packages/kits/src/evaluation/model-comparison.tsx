import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { ChangeCell } from '../../../charts/src/cells/index.ts';
import { DumbbellPlot } from '../../../charts/src/comparison/index.ts';
import { ChartLink, formatValue, useChartLinkControl, useScopedTone } from '../../../charts/src/index.ts';
import type {
  FigureProps,
  FigureSelectionProps,
  PlotAxis,
  PlotHeight,
  ValueFormat,
} from '../../../charts/src/index.ts';
// Deep import: the shared figure frame is not exported from the charts index yet.
import { FigureInvalid } from '../../../charts/src/plot/index.ts';
import { DataTable, DataTablePlaceholder, DataTableText } from '../../../collections/src/index.ts';
import type { DataTableColumn } from '../../../collections/src/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { repeatedId, signedFormat, useLinkedRows } from './evaluation-data.ts';
import type { EvaluationModel } from './evaluation-data.ts';

/** One benchmark in a head-to-head comparison. */
export type ComparisonRow = {
  readonly id: string;
  readonly label: string;
  /** Model A's score, or null where it was not measured. */
  readonly a: number | null;
  /** Model B's score, or null where it was not measured. */
  readonly b: number | null;
  /** B minus A, as the application estimated it, such as a paired mean. Null where it could not be computed. */
  readonly difference: number | null;
  /** The bounds the application computed around the difference, such as a 95% interval. */
  readonly interval?: { readonly low: number; readonly high: number } | undefined;
  /** The application's test of the difference. Absent reads as "not tested". */
  readonly isSignificant?: boolean | undefined;
  /** A short remark in words: "Fewer than 200 items" or "B was tuned on a related set". */
  readonly note?: string | undefined;
};

/** The words the comparison shows that are not data. */
export type ModelComparisonLabels = {
  /** Starts the table's caption: "Differences, Cirrus 34B minus Atlas 70B". */
  readonly caption: string;
  readonly benchmark: string;
  readonly difference: string;
  readonly interval: string;
  readonly reading: string;
  /** Follows the leading model's name in a significant row: "Atlas 13B ahead". */
  readonly ahead: string;
  readonly unclear: string;
  readonly untested: string;
  readonly noInterval: string;
};

export type ModelComparisonProps = FigureProps &
  FigureSelectionProps & {
    /** The reference model, drawn first. */
    readonly a: EvaluationModel;
    /** The model compared with it. Differences are B minus A. */
    readonly b: EvaluationModel;
    readonly rows: ReadonlyArray<ComparisonRow>;
    /** The measured axis of both scores. */
    readonly value: PlotAxis;
    /** Whether a larger score is better. It sets which model a difference favors and the hue of the change. */
    readonly isHigherBetter: boolean;
    /** How the differences are written. Defaults to the axis format with a sign. */
    readonly differenceFormat?: ValueFormat | undefined;
    readonly height?: PlotHeight | undefined;
    readonly labels?: Partial<ModelComparisonLabels> | undefined;
  };

const defaultLabels: ModelComparisonLabels = {
  caption: 'Differences,',
  benchmark: 'Benchmark',
  difference: 'Difference',
  interval: 'Interval',
  reading: 'Reading',
  ahead: 'ahead',
  unclear: '—',
  untested: '—',
  noInterval: '—',
};

const PLACEHOLDER_ROWS = 4;
const columnWidths = { difference: 128, interval: 168, reading: 260 } as const;

const styles = stylex.create({ stack: { display: 'grid', gap: spacing.lg, minWidth: 0 } });

function comparisonProblem({ a, b, rows }: Pick<ModelComparisonProps, 'a' | 'b' | 'rows'>): string | undefined {
  const repeated = repeatedId(rows.map((row) => row.id));

  if (a.id === b.id) {
    return 'Models A and B must be two different models.';
  }

  if (repeated !== undefined) {
    return `The benchmark ${repeated} appears twice. Rows need unique ids.`;
  }

  const unbracketed = rows.find(({ difference, interval }) => {
    if (interval === undefined) {
      return false;
    }

    return difference === null || interval.low > difference || interval.high < difference;
  });

  if (unbracketed !== undefined) {
    return `The interval of ${unbracketed.label} must hold its difference, with the low bound first.`;
  }

  const unsigned = rows.find((row) => row.isSignificant === true && (row.difference === null || row.difference === 0));

  return unsigned === undefined ? undefined : `${unsigned.label} is marked significant but has no difference.`;
}

/**
 * Two models head to head across benchmarks: a dumbbell of A against B per benchmark, then a table of differences, each
 * with its interval and a test in words. Model A is the reference, every difference is B minus A, and each model keeps
 * its hue from an enclosing tone scope. Resting on a table row marks the benchmark in the plot and the other way round,
 * and the application supplies every score, difference and test.
 */
export function ModelComparison(props: ModelComparisonProps): ReactNode {
  return (
    <ChartLink>
      <ComparisonBody {...props} />
    </ChartLink>
  );
}

function ComparisonBody(props: ModelComparisonProps): ReactNode {
  const { a, b, rows, value, isHigherBetter, differenceFormat, height, labels: custom, ...figure } = props;
  const { selected, onSelectedChange, ...frame } = figure;
  const labels = { ...defaultLabels, ...custom };
  const scopedA = useScopedTone(a.id);
  const scopedB = useScopedTone(b.id);
  const fromTone = a.tone ?? scopedA ?? 'series1';
  const toTone = b.tone ?? scopedB ?? 'series2';
  const link = useChartLinkControl();
  const onRowHighlightChange = useLinkedRows(rows.map((row) => row.id));
  const format = differenceFormat ?? signedFormat(value.format);
  const { locale } = frame;

  const problem = frame.status === 'loading' ? undefined : comparisonProblem({ a, b, rows });

  if (problem !== undefined) {
    return <FigureInvalid {...frame} message={problem} />;
  }

  function reading(row: ComparisonRow): string {
    if (row.isSignificant === undefined) {
      return labels.untested;
    }

    if (!row.isSignificant) {
      return labels.unclear;
    }

    const isBAhead = (row.difference ?? 0) > 0 === isHigherBetter;

    return `${isBAhead ? b.label : a.label} ${labels.ahead}`;
  }

  const hasIntervals = rows.some((row) => row.interval !== undefined);

  const columns: ReadonlyArray<DataTableColumn<ComparisonRow> & { readonly canSort?: false }> = [
    { id: 'benchmark', label: labels.benchmark, role: 'primary', cell: (row) => row.label },
    {
      id: 'difference',
      label: labels.difference,
      role: 'number',
      width: columnWidths.difference,
      cell: (row) => (
        <ChangeCell
          value={row.difference}
          positiveIs={isHigherBetter ? 'good' : 'bad'}
          locale={locale}
          format={format}
        />
      ),
    },
    ...(hasIntervals
      ? [
          {
            id: 'interval',
            label: labels.interval,
            role: 'number' as const,
            width: columnWidths.interval,
            cell: (row: ComparisonRow) =>
              row.interval === undefined
                ? labels.noInterval
                : `${formatValue({ value: row.interval.low, locale, format })} to ${formatValue({ value: row.interval.high, locale, format })}`,
          },
        ]
      : []),
    {
      id: 'reading',
      label: labels.reading,
      role: 'text',
      width: columnWidths.reading,
      cell: (row) => <DataTableText secondary={row.note}>{reading(row)}</DataTableText>,
    },
  ];

  return (
    <div {...stylex.props(styles.stack)}>
      <DumbbellPlot
        {...frame}
        rows={rows.map((row) => ({ id: row.id, label: row.label, from: row.a, to: row.b }))}
        fromLabel={a.label}
        toLabel={b.label}
        fromTone={fromTone}
        toTone={toTone}
        value={value}
        height={height}
        selected={selected}
        onSelectedChange={onSelectedChange}
      />
      {frame.status === 'loading' ? (
        <DataTablePlaceholder
          caption={`${labels.caption} ${b.label} minus ${a.label}`}
          hideCaption
          columns={columns}
          rows={PLACEHOLDER_ROWS}
          rowSizing="content"
        />
      ) : (
        rows.length > 0 && (
          <DataTable
            query={{ mode: 'static', reason: 'The comparison lists every benchmark it is given.' }}
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            caption={`${labels.caption} ${b.label} minus ${a.label}`}
            hideCaption
            empty={null}
            rowSizing="content"
            activeRowId={link?.inspected ?? undefined}
            onRowHighlightChange={onRowHighlightChange}
          />
        )
      )}
    </div>
  );
}
