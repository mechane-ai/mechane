import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartLegend, ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { locateNearest } from '../plot/locate.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle, categoryPlot, fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis } from '../plot/plot-layout.ts';
import { BarMark, LabelMark, RuleMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { quoteToken, TokenText } from './token-text.tsx';

/** One predicted token: its exact text, its value, and optionally its value under a baseline condition. */
export type TokenPrediction = {
  readonly id: string;
  readonly token: string;
  /** The value of this prediction, or null where none was recorded. */
  readonly probability: number | null;
  /** The value before an intervention, such as before steering. Drawn as a tick on the same axis. */
  readonly baseline?: number | null | undefined;
  /** True for the token the application expects, such as the correct answer. It is marked "target" in text. */
  readonly isTarget?: boolean | undefined;
};

export type TokenPredictionsProps = FigureProps &
  FigureSelectionProps & {
    /** The predictions in the order to draw them, usually most likely first. */
    readonly predictions: ReadonlyArray<TokenPrediction>;
    /** What the bars measure. Defaults to "Probability". */
    readonly valueLabel?: string | undefined;
    /** How values are written. Defaults to a percent. */
    readonly valueFormat?: ValueFormat | undefined;
    /** The value axis. It always holds zero, where the bars start. Leave it out to fit the values on round bounds. */
    readonly domain?: NumericDomain | undefined;
    /** What the baseline ticks are, such as "Before steering". */
    readonly baselineLabel?: string | undefined;
  };

/** The most predictions `TokenPredictions` draws. */
export const tokenPredictionLimits = { rows: 50 } as const;

const ROW_STEP = 28;
const PLOT_CHROME = 56;
const CHIP_GAP = 8;
/** The chip's padding, border and gap, in characters, so the gutter fits the longest chip before it is cut. */
const CHIP_CHROME_CHARACTERS = 4;
const LABEL_GAP = 6;
const LABEL_BASELINE = 4;
const CHARACTER_WIDTH = 7;
const TICK_OVERHANG = 4;
const TARGET_TEXT = 'target';
const percent = { style: 'percent', maximumFractionDigits: 1 } as const;

const styles = stylex.create({
  chips: (top: number, height: number, width: number) => ({ top, height, width }),
  chip: {
    position: 'absolute',
    left: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    minWidth: 0,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  token: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    paddingInline: spacing.xs,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
  target: { flexShrink: 0, fontWeight: typography.strongWeight },
  inspected: { fill: colors.canvas },
  selected: { fill: colors.line },
  pointerless: { pointerEvents: 'none' },
  cursor: { fill: 'none' },
});

function changeFormat(format: ValueFormat): ValueFormat {
  if (typeof format === 'function') {
    return (value) => `${value > 0 ? '+' : ''}${format(value)}`;
  }

  return { ...format, signDisplay: 'exceptZero' };
}

function predictionsInputError(predictions: ReadonlyArray<TokenPrediction>, domain: NumericDomain): string | undefined {
  const domainError = scaleDomainError(domain);

  if (domainError !== undefined) {
    return domainError;
  }

  if (domain[0] > 0 || domain[1] < 0) {
    return 'The value domain must hold zero, where the bars start.';
  }

  if (predictions.length > tokenPredictionLimits.rows) {
    return `This chart draws at most ${tokenPredictionLimits.rows} predictions. Supply the leading ones.`;
  }

  if (!hasUniqueIds(predictions)) {
    return 'Predictions must have unique identifiers.';
  }

  const invalid = predictions.find((prediction) =>
    [prediction.probability, prediction.baseline ?? null].some(
      (value) => value !== null && outsideDomain(value, domain),
    ),
  );

  return invalid === undefined
    ? undefined
    : `Prediction ${invalid.id} has a value that is not finite or lies outside the value domain.`;
}

/**
 * What a model predicts next, as ranked tokens: each row is a token chip and a bar from zero, in one hue, with the
 * target token marked in text. An ink tick on the same axis shows the value under another condition, such as before
 * steering, and the readout gives both values and the signed change. Use it beside a prompt to show the next-token
 * distribution, or to compare it before and after an intervention.
 */
export function TokenPredictions(props: TokenPredictionsProps): ReactNode {
  const {
    predictions,
    valueLabel = 'Probability',
    valueFormat = percent,
    domain,
    baselineLabel = 'Baseline',
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No predictions are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize();
  const readoutId = useId();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const values = predictions.flatMap((prediction) => [prediction.probability, prediction.baseline ?? null]);
  const valueDomain = domain ?? fitDomain({ values, isZeroBased: true });
  const inputError = predictionsInputError(predictions, valueDomain);

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function valueText(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const hasBaseline = predictions.some((prediction) => prediction.baseline !== undefined);
  const axis: PlotAxis = { label: valueLabel, domain: valueDomain, format: valueFormat };

  const plot = categoryPlot({
    width: size.width,
    height: predictions.length * ROW_STEP + PLOT_CHROME,
    direction: 'rows',
    categories: predictions.map((prediction) => {
      const label = `${prediction.token}${prediction.isTarget === true ? ` ${TARGET_TEXT}` : ''}`;

      return { id: prediction.id, label: label.padEnd(label.length + CHIP_CHROME_CHARACTERS) };
    }),
    value: axis,
    valueDomain,
    locale,
  });

  const { box, band } = plot;
  const zero = plot.value.position(0);

  const items = predictions.map((prediction) => {
    const target = prediction.isTarget === true ? ` (${TARGET_TEXT})` : '';
    const own = `${quoteToken(prediction.token)}${target}: ${valueLabel} ${valueText(prediction.probability)}`;
    const { baseline } = prediction;

    if (baseline === undefined) {
      return { id: prediction.id, label: own };
    }

    const change = baseline === null || prediction.probability === null ? null : prediction.probability - baseline;
    const changeText = formatValue({ value: change, locale, format: changeFormat(valueFormat) });

    return { id: prediction.id, label: `${own} · ${baselineLabel} ${valueText(baseline)} · Change ${changeText}` };
  });

  const marks = predictions.flatMap((prediction) => {
    const y = band.center(prediction.id);

    return y === undefined ? [] : [{ id: prediction.id, x: 0, y }];
  });

  function rowFrame(id: string): { readonly y: number; readonly height: number } {
    return { y: (band.start(id) ?? 0) - (band.step - band.bandwidth) / 2, height: band.step };
  }

  return (
    <Chart
      items={items}
      arrows="both"
      locate={locateNearest({ marks, width: box.width, height: box.height, axis: 'y' })}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor, selected: chosen }) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          seriesLegend={
            hasBaseline && predictions.length > 0 ? (
              <ChartLegend
                items={[
                  { id: 'value', label: valueLabel, tone: 'series1' },
                  { id: 'baseline', label: baselineLabel, tone: 'neutral', shape: 'tick' },
                ]}
              />
            ) : undefined
          }
          footer={<ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>}
        >
          {predictions.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <PlotSurface
                plotRef={size.ref}
                box={box}
                label={plotLabel({ title, marks: 'predictions', isSelectable: onSelectedChange !== undefined })}
                readoutId={readoutId}
                overlay={predictions.map((prediction) => (
                  <div
                    key={prediction.id}
                    {...stylex.props(
                      styles.chip,
                      styles.chips(band.start(prediction.id) ?? 0, band.bandwidth, Math.max(0, box.left - CHIP_GAP)),
                    )}
                  >
                    <span {...stylex.props(styles.token)}>
                      <TokenText text={prediction.token} shouldWrap={false} />
                    </span>
                    {prediction.isTarget === true && <span {...stylex.props(styles.target)}>{TARGET_TEXT}</span>}
                  </div>
                ))}
              >
                {predictions
                  .filter((prediction) => prediction.id === inspected || prediction.id === chosen)
                  .map((prediction) => (
                    <rect
                      key={prediction.id}
                      x={box.left}
                      width={box.innerWidth}
                      {...rowFrame(prediction.id)}
                      {...stylex.props(
                        styles.pointerless,
                        styles.inspected,
                        prediction.id === chosen && styles.selected,
                      )}
                    />
                  ))}
                <PlotAxes box={box} xTicks={plot.valueTicks} yTicks={[]} xTitle={axisTitle(axis)} grid="x" />
                <PlotClip box={box}>
                  {predictions.map((prediction) => {
                    const top = band.start(prediction.id) ?? 0;
                    const { probability, baseline = null } = prediction;
                    const end = probability === null ? zero : plot.value.position(probability);

                    return (
                      <g key={prediction.id}>
                        {probability !== null && (
                          <BarMark
                            x={Math.min(zero, end)}
                            y={top}
                            width={Math.abs(end - zero)}
                            height={band.bandwidth}
                            tone="series1"
                            isSelected={prediction.id === chosen}
                          />
                        )}
                        {baseline !== null && (
                          <RuleMark
                            x1={plot.value.position(baseline)}
                            x2={plot.value.position(baseline)}
                            y1={top - TICK_OVERHANG}
                            y2={top + band.bandwidth + TICK_OVERHANG}
                          />
                        )}
                      </g>
                    );
                  })}
                </PlotClip>
                {predictions.map((prediction) => {
                  const text = valueText(prediction.probability);
                  const end = prediction.probability === null ? zero : plot.value.position(prediction.probability);
                  const { baseline = null } = prediction;
                  const tick = baseline === null ? zero : plot.value.position(baseline);
                  const clear = Math.max(zero, end, tick);
                  const textWidth = text.length * CHARACTER_WIDTH;
                  const isInside = clear + LABEL_GAP + textWidth > box.right;
                  const isTickUnder = tick < end && tick > end - LABEL_GAP - textWidth;

                  return (
                    <LabelMark
                      key={prediction.id}
                      x={isInside ? (isTickUnder ? tick : end) - LABEL_GAP : clear + LABEL_GAP}
                      y={(band.center(prediction.id) ?? 0) + LABEL_BASELINE}
                      anchor={isInside ? 'end' : 'start'}
                    >
                      {text}
                    </LabelMark>
                  );
                })}
                {cursor !== null && (
                  <rect
                    x={box.left}
                    width={box.innerWidth}
                    {...rowFrame(cursor)}
                    {...stylex.props(styles.pointerless, styles.cursor, chartStyles.cursor)}
                  />
                )}
              </PlotSurface>
              <ChartData
                label={`${title} predictions`}
                columns={[{ id: 'prediction', label: 'Prediction' }]}
                rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
              />
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}
