import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { hasUniqueIds } from '../chart-input.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { fitDomain, numericPlot } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { ColumnFigure } from './column-figure.tsx';
import type { ColumnLine } from './column-figure.tsx';
import { columnPositions } from './column-positions.ts';
import { gutterChars, labelGutter, labelsHeight, truncateLabel } from './end-labels.tsx';

/** One condition the items are measured under, such as before and after fine-tuning. */
export type SlopeCondition = { readonly id: string; readonly label: string };

export type SlopeItem = {
  readonly id: string;
  readonly label: string;
  /** One value per condition, in the conditions' order. Null where the item was not measured. The line breaks there. */
  readonly values: ReadonlyArray<number | null>;
  readonly tone?: ChartTone | undefined;
};

export type SlopeChartProps = FigureProps &
  FigureSelectionProps & {
    /** Two to six ordered conditions, drawn as evenly spaced columns. */
    readonly conditions: ReadonlyArray<SlopeCondition>;
    readonly items: ReadonlyArray<SlopeItem>;
    readonly value: PlotAxis;
    readonly height?: PlotHeight | undefined;
  };

export const slopeLimits = { items: 40, conditionsMin: 2, conditionsMax: 6 } as const;

const PLOT_PADDING = 48;
const UNUSED_AXIS = { label: '', format: {} } as const;

function slopeInputError({
  conditions,
  items,
  domain,
  value,
}: Pick<SlopeChartProps, 'conditions' | 'items' | 'value'> & { readonly domain: NumericDomain }): string | undefined {
  const domainError = scaleDomainError(domain, value.scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (conditions.length < slopeLimits.conditionsMin || conditions.length > slopeLimits.conditionsMax) {
    return `This chart compares ${slopeLimits.conditionsMin} to ${slopeLimits.conditionsMax} conditions.`;
  }

  if (!hasUniqueIds(conditions) || !hasUniqueIds(items)) {
    return 'Conditions and items must have unique identifiers.';
  }

  if (items.length > slopeLimits.items) {
    return `This chart draws at most ${slopeLimits.items} items. Supply the ones to compare.`;
  }

  const misaligned = items.find((item) => item.values.length !== conditions.length);

  if (misaligned !== undefined) {
    return `Item ${misaligned.id} needs one value for each of the ${conditions.length} conditions.`;
  }

  const outside = items.find((item) => item.values.some((entry) => entry !== null && outsideDomain(entry, domain)));

  return outside === undefined
    ? undefined
    : `Item ${outside.id} has a value that is not finite or lies outside the declared domain.`;
}

/**
 * The same things measured under two or a few ordered conditions, such as benchmark scores before and after
 * fine-tuning. Each item is one line across the conditions with its value written at both ends, so a reader sees who
 * rose, who fell and by how much. A missing value breaks the line and is said in the readout, and `CurveChart` fits
 * better when the conditions are many or measured along a continuous variable.
 */
export function SlopeChart(props: SlopeChartProps): ReactNode {
  const { conditions, items, value, height = 'regular', selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No measurements are available.', ...frame } = figure;
  const { locale } = frame;
  const size = usePlotSize(height);
  const tones = useTones();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const domain = value.domain ?? fitDomain({ values: items.flatMap((item) => item.values), scale: value.scale });
  const inputError = slopeInputError({ conditions, items, domain, value });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function valueText(entry: number | null | undefined): string {
    return formatValue({ value: entry ?? null, locale, format: value.format });
  }

  const drawn = items.map((item, index) => ({ ...item, tone: tones({ id: item.id, tone: item.tone, index }) }));

  const ends = drawn.map((item) => ({
    first: item.values[0] ?? null,
    last: item.values[conditions.length - 1] ?? null,
  }));

  const startGutter = labelGutter({
    labels: drawn.map((item, index) => `${item.label} ${valueText(ends[index]?.first)}`),
    width: size.width,
  });

  const endGutter = labelGutter({
    labels: drawn.map((item, index) => `${valueText(ends[index]?.last)} ${item.label}`),
    width: size.width,
  });

  const plot = numericPlot({
    width: size.width,
    height: Math.max(size.height, labelsHeight(items.length) + PLOT_PADDING),
    x: UNUSED_AXIS,
    y: value,
    xDomain: [0, 1],
    yDomain: domain,
    locale,
  });

  const { box } = plot;

  const columns = columnPositions({
    box,
    columnLabels: conditions.map((condition) => condition.label),
    leftGutter: startGutter,
    rightGutter: endGutter,
  });

  const { xs } = columns;

  const xTicks = conditions.map((condition, index) => ({
    key: condition.id,
    position: xs[index] ?? box.left,
    label: condition.label,
  }));

  const lines: ReadonlyArray<ColumnLine> = drawn.map((item, index) => {
    const first = valueText(ends[index]?.first);
    const last = valueText(ends[index]?.last);

    return {
      id: item.id,
      tone: item.tone,
      ys: item.values.map((entry) => (entry === null ? null : plot.y.position(entry))),
      startLabel: `${truncateLabel(item.label, gutterChars(columns.leftGutter) - first.length - 1)} ${first}`,
      endLabel: `${last} ${truncateLabel(item.label, gutterChars(columns.rightGutter) - last.length - 1)}`,
    };
  });

  const entries = drawn.map((item) => ({
    id: item.id,
    label: `${item.label}: ${conditions.map((condition, index) => `${condition.label} ${valueText(item.values[index])}`).join(' · ')}`,
  }));

  return (
    <ColumnFigure
      frame={frame}
      emptyLabel={emptyLabel}
      plotRef={size.ref}
      box={box}
      xs={xs}
      xTicks={xTicks}
      yTicks={plot.yTicks}
      yTitle={value.label}
      lines={lines}
      items={entries}
      legend={drawn.map((item) => ({ id: item.id, label: item.label, tone: item.tone, shape: 'line' }))}
      marks="items"
      selected={selected}
      onSelectedChange={onSelectedChange}
    />
  );
}
