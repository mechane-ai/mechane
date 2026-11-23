import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { hasUniqueIds } from '../chart-input.ts';
import { formatValue, MISSING_VALUE_TEXT } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import type { PlotHeight, PlotTick } from '../plot/plot-layout.ts';
import { plotBox, plotMargins } from '../plot/plot-layout.ts';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { continuousScale } from '../plot/scale.ts';
import { ColumnFigure } from './column-figure.tsx';
import type { ColumnLine } from './column-figure.tsx';
import { columnPositions } from './column-positions.ts';
import { gutterChars, labelGutter, labelsHeight, truncateLabel } from './end-labels.tsx';

/** One stage the ranks are given at, such as a month or a checkpoint. */
export type BumpStage = { readonly id: string; readonly label: string };

export type BumpItem = {
  readonly id: string;
  readonly label: string;
  /** One whole-number rank per stage, from 1 for the best. Null where the item is not ranked at that stage. */
  readonly ranks: ReadonlyArray<number | null>;
  readonly tone?: ChartTone | undefined;
};

export type BumpChartProps = FigureProps & {
  /** The ordered stages, drawn as evenly spaced columns. */
  readonly stages: ReadonlyArray<BumpStage>;
  readonly items: ReadonlyArray<BumpItem>;
  readonly height?: PlotHeight | undefined;
};

export const bumpLimits = { items: 30, stages: 24, rank: 100 } as const;

const PLOT_PADDING = 48;
const RANK_SPACING = 18;
const HALF = 0.5;

function bumpInputError({ stages, items }: Pick<BumpChartProps, 'stages' | 'items'>): string | undefined {
  if (!hasUniqueIds(stages) || !hasUniqueIds(items)) {
    return 'Stages and items must have unique identifiers.';
  }

  if (items.length > bumpLimits.items || stages.length > bumpLimits.stages) {
    return `This chart draws at most ${bumpLimits.items} items over ${bumpLimits.stages} stages.`;
  }

  const misaligned = items.find((item) => item.ranks.length !== stages.length);

  if (misaligned !== undefined) {
    return `Item ${misaligned.id} needs one rank for each of the ${stages.length} stages.`;
  }

  const invalid = items.find((item) =>
    item.ranks.some((rank) => {
      if (rank === null) {
        return false;
      }

      return !Number.isInteger(rank) || rank < 1 || rank > bumpLimits.rank;
    }),
  );

  if (invalid !== undefined) {
    return `Item ${invalid.id} has a rank that is not a whole number from 1 to ${bumpLimits.rank}.`;
  }

  const shared = stages.find((_, index) => {
    const ranks = items.flatMap((item) => item.ranks[index] ?? []);

    return new Set(ranks).size !== ranks.length;
  });

  return shared === undefined ? undefined : `Two items share a rank at stage ${shared.id}. Supply one item per rank.`;
}

/**
 * Rank over ordered stages, such as a model leaderboard by month. Rank 1 is at the top, each item is one line, and
 * inspecting an item makes the others recede so its path stands out. The application supplies the ranks, one item per
 * rank at each stage, and an item with no rank at a stage leaves a gap in its line.
 */
export function BumpChart(props: BumpChartProps): ReactNode {
  const { stages, items, height = 'regular', ...figure } = props;
  const { emptyLabel = 'No ranks are available.', ...frame } = figure;
  const { locale } = frame;
  const size = usePlotSize(height);
  const tones = useTones();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const inputError = bumpInputError({ stages, items });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function rankText(rank: number | null | undefined): string {
    return rank === null || rank === undefined
      ? MISSING_VALUE_TEXT
      : `rank ${formatValue({ value: rank, locale, format: { maximumFractionDigits: 0 } })}`;
  }

  const drawn = items.map((item, index) => ({ ...item, tone: tones({ id: item.id, tone: item.tone, index }) }));
  const lowest = Math.max(1, ...items.flatMap((item) => item.ranks.flatMap((rank) => rank ?? [])));
  const gutter = labelGutter({ labels: drawn.map((item) => item.label), width: size.width });

  const margins = plotMargins({ width: size.width, valueLabels: [String(lowest)], hasXTitle: false, hasYTitle: true });

  const box = plotBox({
    width: size.width,
    height: Math.max(size.height, labelsHeight(Math.max(lowest, items.length)) + PLOT_PADDING),
    margins,
  });

  const rankScale = continuousScale({ domain: [HALF, lowest + HALF], range: [box.top, box.bottom] });
  const stride = Math.max(1, Math.ceil(RANK_SPACING / (box.innerHeight / lowest)));

  const yTicks: ReadonlyArray<PlotTick> = Array.from({ length: lowest }, (_, index) => index + 1)
    .filter((rank) => (rank - 1) % stride === 0)
    .map((rank) => ({ key: String(rank), position: rankScale.position(rank), label: String(rank) }));

  const columns = columnPositions({
    box,
    columnLabels: stages.map((stage) => stage.label),
    leftGutter: gutter,
    rightGutter: gutter,
  });

  const { xs } = columns;

  const xTicks = stages.map((stage, index) => ({ key: stage.id, position: xs[index] ?? box.left, label: stage.label }));

  const lines: ReadonlyArray<ColumnLine> = drawn.map((item) => {
    const label = truncateLabel(item.label, gutterChars(Math.min(columns.leftGutter, columns.rightGutter)));

    return {
      id: item.id,
      tone: item.tone,
      ys: item.ranks.map((rank) => (rank === null ? null : rankScale.position(rank))),
      startLabel: label,
      endLabel: label,
    };
  });

  const entries = drawn.map((item) => ({
    id: item.id,
    label: `${item.label}: ${stages.map((stage, index) => `${stage.label} ${rankText(item.ranks[index])}`).join(' · ')}`,
  }));

  return (
    <ColumnFigure
      frame={frame}
      emptyLabel={emptyLabel}
      plotRef={size.ref}
      box={box}
      xs={xs}
      xTicks={xTicks}
      yTicks={yTicks}
      yTitle="Rank"
      lines={lines}
      items={entries}
      legend={drawn.map((item) => ({ id: item.id, label: item.label, tone: item.tone, shape: 'line' }))}
      marks="items"
    />
  );
}
