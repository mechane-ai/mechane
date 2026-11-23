import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { Chart } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { locateNearest } from '../plot/locate.ts';
import { linePath } from '../plot/path.ts';
import { fitDomain, numericPlot } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, LineMark } from '../plot/plot-marks.tsx';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { distributionInputError, distributionLimits } from './distribution-input.ts';
import { DistributionFigure } from './distribution-plot.tsx';

/** One prepared step of an empirical cumulative distribution: the share of observations at or below `value`. */
export type ECDFPoint = { readonly id: string; readonly value: number; readonly probability: number | null };

export type ECDFProps = FigureProps &
  FigureSelectionProps & {
    /** Points in increasing `value` whose probability never decreases. A null probability breaks the line. */
    readonly points: ReadonlyArray<ECDFPoint>;
    /** The measured variable, with its unit. */
    readonly value: PlotAxis;
    /** The cumulative share. Its domain is zero to one when left out. */
    readonly probability: PlotAxis;
    readonly tone?: ChartTone | undefined;
    readonly height?: PlotHeight | undefined;
  };

const PROBABILITY_DOMAIN: NumericDomain = [0, 1];
const CURSOR_WIDTH = 12;
const POINT_RADIUS = 2;
const ACTIVE_RADIUS = 4;

function ecdfInputError({
  points,
  value,
  probability,
  valueDomain,
  probabilityDomain,
}: Pick<ECDFProps, 'points' | 'value' | 'probability'> & {
  readonly valueDomain: NumericDomain;
  readonly probabilityDomain: NumericDomain;
}): string | undefined {
  const error =
    distributionInputError({
      items: points,
      domain: valueDomain,
      scale: value.scale,
      maxEntries: distributionLimits.cumulativePoints,
    }) ?? scaleDomainError(probabilityDomain, probability.scale);

  if (error !== undefined) {
    return error;
  }

  const misplaced = points.find(
    (point, index) => outsideDomain(point.value, valueDomain) || point.value < (points[index - 1]?.value ?? -Infinity),
  );

  if (misplaced !== undefined) {
    return `Cumulative point ${misplaced.id} is non-finite, outside the domain, or out of order.`;
  }

  const recorded = points.flatMap((point) =>
    point.probability === null ? [] : [{ id: point.id, share: point.probability }],
  );

  const decreasing = recorded.find((point, index) => {
    const isOutside = outsideDomain(point.share, probabilityDomain) || outsideDomain(point.share, PROBABILITY_DOMAIN);

    return isOutside || point.share < (recorded[index - 1]?.share ?? 0);
  });

  if (decreasing !== undefined) {
    return `Cumulative point ${decreasing.id} must have a probability from zero to one that does not decrease.`;
  }

  return undefined;
}

/**
 * The share of observations at or below each value, drawn as a step line from prepared points: latency percentiles,
 * score thresholds, calibration. Read a percentile across from the probability axis. Use `Histogram` for counts.
 */
export function ECDF(props: ECDFProps): ReactNode {
  const {
    points,
    value,
    probability,
    tone = 'series1',
    height = 'regular',
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No cumulative distribution points are available.', ...frame } = figure;
  const { locale } = frame;
  const size = usePlotSize(height);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const valueDomain = value.domain ?? fitDomain({ values: points.map((point) => point.value), scale: value.scale });
  const probabilityDomain = probability.domain ?? PROBABILITY_DOMAIN;
  const inputError = ecdfInputError({ points, value, probability, valueDomain, probabilityDomain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const plot = numericPlot({
    width: size.width,
    height: size.height,
    x: value,
    y: probability,
    xDomain: valueDomain,
    yDomain: probabilityDomain,
    locale,
  });

  const { box } = plot;

  const items = points.map((point) => ({
    id: point.id,
    label: `${value.label}: ${formatValue({ value: point.value, locale, format: value.format })}, ${probability.label}: ${formatValue({ value: point.probability, locale, format: probability.format })}`,
  }));

  const line = points.map((point) => ({
    x: plot.x.position(point.value),
    y: point.probability === null ? null : plot.y.position(point.probability),
  }));

  const marks = points.map((point, index) => ({ id: point.id, x: line[index]?.x ?? 0, y: 0 }));

  return (
    <Chart
      items={items}
      arrows="both"
      locate={locateNearest({ marks, width: box.width, height: box.height, axis: 'x' })}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, view) => {
        const rest = points.find((point) => point.id === view.cursor);

        return (
          <DistributionFigure
            frame={frame}
            figure={figureProps}
            items={items}
            inspected={view.inspected}
            plotRef={size.ref}
            plot={plot}
            x={value}
            y={probability}
            isSelectable={onSelectedChange !== undefined}
            emptyLabel={emptyLabel}
            overlay={
              <>
                {points.map((point) => {
                  const isSelected = view.selected === point.id;
                  const isInspected = view.inspected === point.id;

                  return point.probability === null ? null : (
                    <DotMark
                      key={point.id}
                      x={plot.x.position(point.value)}
                      y={plot.y.position(point.probability)}
                      tone={tone}
                      radius={isSelected || isInspected ? ACTIVE_RADIUS : POINT_RADIUS}
                      isSelected={isSelected}
                      isInspected={isInspected}
                    />
                  );
                })}
                {rest !== undefined && (
                  <ChartCursor x={plot.x.position(rest.value)} top={box.top} bottom={box.bottom} width={CURSOR_WIDTH} />
                )}
              </>
            }
          >
            <LineMark d={linePath(line, 'step')} tone={tone} />
          </DistributionFigure>
        );
      }}
    />
  );
}
