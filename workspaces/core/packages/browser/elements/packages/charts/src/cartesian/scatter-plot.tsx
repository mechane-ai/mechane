import * as stylex from '@stylexjs/stylex';
import { bindDrag, dispatch } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps, PointerEvent, ReactNode } from 'react';
import { TextButton } from '../../../core/src/index.ts';
import { Slider } from '../../../forms/src/index.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { linePath } from '../plot/path.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle, fitDomain, numericPlot } from '../plot/plot-layout.ts';
import type { NumericPlotLayout, PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, LabelMark, LineMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { ReferenceMarks, validateReferenceLines } from './reference-lines.tsx';
import type { ChartReferenceLine } from './reference-lines.tsx';

/** One supplied coordinate pair with a stable id, so selection survives reordering. */
export type ScatterPoint = {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly tone?: ChartTone | undefined;
};

/** A rectangle of coordinates, in axis values, that the reader selected. */
export type ScatterRange = { readonly x: NumericDomain; readonly y: NumericDomain };

type SliderDetails = Parameters<NonNullable<ComponentProps<typeof Slider.Root<[number, number]>>['onValueChange']>>[1];

/** Why the range changed: a drag on the plot, one of the bound sliders, or the clear button. */
export type ScatterRangeDetails = ChangeDetails<'drag' | 'clear-press'> | SliderDetails;

/** A dashed `y = x` identity reference line drawn across the overlapping x and y domains. */
export type ScatterDiagonal = {
  /** Caption drawn beside the diagonal line (such as `"y = x"`). */
  readonly label?: string | undefined;
  /** Quiet region caption in the upper-left (`y > x`) half of the plot. */
  readonly aboveLabel?: string | undefined;
  /** Quiet region caption in the lower-right (`y < x`) half of the plot. */
  readonly belowLabel?: string | undefined;
};

export type ScatterPlotProps = FigureProps &
  FigureSelectionProps & {
    readonly points: ReadonlyArray<ScatterPoint>;
    readonly x: PlotAxis;
    readonly y: PlotAxis;
    /** Optional `y = x` reference diagonal (true or labelled regions) for paired/generalization plots. */
    readonly referenceDiagonal?: boolean | ScatterDiagonal | undefined;
    /** Optional dashed horizontal reference lines on the y axis (such as a baseline or ceiling). */
    readonly referenceLines?: ReadonlyArray<ChartReferenceLine> | undefined;
    /** Ordered point ids connected by a dashed Pareto/frontier line. Computed by the application. */
    readonly frontier?: ReadonlyArray<string> | undefined;
    /** Point ids that carry a direct haloed label beside their mark. */
    readonly labeledIds?: ReadonlyArray<string> | undefined;
    /** The coordinate range the application holds, or null for none. */
    readonly range?: ScatterRange | null | undefined;
    /** Asks the application to set or clear the range. With it, the plot offers a drag and two range sliders. */
    readonly onRangeChange?: ((range: ScatterRange | null, details: ScatterRangeDetails) => void) | undefined;
    /** The slider steps on each axis, in axis units. Required with `onRangeChange`. */
    readonly rangeStep?: { readonly x: number; readonly y: number } | undefined;
    readonly height?: PlotHeight | undefined;
  };

/** The most points one scatter plot draws. Supply a labelled sample or window for more. */
export const scatterLimits = { points: 1000 } as const;

type Coordinate = { readonly x: number; readonly y: number };
type Gesture = { readonly start: Coordinate; readonly end: Coordinate };

const POINT_TARGET = 44;
const RING_SIZE = 12;

const styles = stylex.create({
  brush: { cursor: 'crosshair', fill: 'transparent' },
  range: {
    fill: colors.focus,
    fillOpacity: 0.08,
    stroke: colors.focus,
    strokeWidth: 1,
    strokeDasharray: '4 3',
    pointerEvents: 'none',
  },
  diagonal: {
    stroke: colors.muted,
    strokeWidth: 1,
    strokeDasharray: '4 4',
    pointerEvents: 'none',
    vectorEffect: 'non-scaling-stroke',
  },
  regionLabel: {
    fill: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    pointerEvents: 'none',
  },
  target: {
    'position': 'absolute',
    'display': 'grid',
    'placeItems': 'center',
    'width': POINT_TARGET,
    'height': POINT_TARGET,
    'transform': 'translate(-50%, -50%)',
    'borderWidth': 0,
    'padding': 0,
    'backgroundColor': 'transparent',
    'cursor': 'pointer',
    'pointerEvents': 'auto',
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -8,
    },
    ':hover:not(:focus-visible)': {
      outlineWidth: { [conditions.hoverPointer]: controls.focusWidth },
      outlineColor: { [conditions.hoverPointer]: colors.line },
      outlineStyle: { [conditions.hoverPointer]: 'solid' },
      outlineOffset: -8,
    },
  },
  location: (left: number, top: number) => ({ left, top }),
  ring: { width: RING_SIZE, height: RING_SIZE, borderRadius: '50%' },
  rangeControls: {
    display: 'grid',
    gap: spacing.md,
    marginBlockStart: spacing.md,
    borderWidth: 0,
    padding: 0,
    minWidth: 0,
  },
  legend: { color: colors.muted, fontSize: typography.captionSize, marginBlockEnd: spacing.sm },
  rangeTitle: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    overflowWrap: 'anywhere',
  },
});

function isRangeWithinDomain(range: NumericDomain, domain: NumericDomain): boolean {
  if (!range.every(Number.isFinite) || range[0] > range[1]) {
    return false;
  }

  return range[0] >= domain[0] && range[1] <= domain[1];
}

function isStepWithin(step: number, domain: NumericDomain): boolean {
  return Number.isFinite(step) && step > 0 && step <= domain[1] - domain[0];
}

function scatterProblem({
  points,
  x,
  y,
  xDomain,
  yDomain,
  range,
  onRangeChange,
  rangeStep,
}: Pick<ScatterPlotProps, 'points' | 'x' | 'y' | 'range' | 'onRangeChange' | 'rangeStep'> & {
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
}): string | undefined {
  const domainError = scaleDomainError(xDomain, x.scale) ?? scaleDomainError(yDomain, y.scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (points.length > scatterLimits.points) {
    return `This plot exceeds the ${scatterLimits.points}-point render limit. Supply a smaller, labelled sample.`;
  }

  if (!hasUniqueIds(points)) {
    return 'Scatter points must have unique identifiers.';
  }

  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return 'Scatter coordinates must be finite.';
  }

  if (points.some((point) => outsideDomain(point.x, xDomain) || outsideDomain(point.y, yDomain))) {
    return 'Scatter coordinates fall outside the declared domain. Widen the domain or supply a labelled window of points.';
  }

  if (onRangeChange === undefined) {
    return undefined;
  }

  if (rangeStep === undefined || !isStepWithin(rangeStep.x, xDomain) || !isStepWithin(rangeStep.y, yDomain)) {
    return 'Range selection steps must be finite, positive, and no larger than their domain span.';
  }

  if (range === null || range === undefined) {
    return undefined;
  }

  if (!isRangeWithinDomain(range.x, xDomain) || !isRangeWithinDomain(range.y, yDomain)) {
    return 'The selected range must have finite, ordered bounds inside the declared domain.';
  }

  return undefined;
}

function ordered(first: number, second: number): NumericDomain {
  return [Math.min(first, second), Math.max(first, second)];
}

/**
 * Supplied coordinates as points on two measured axes, such as an embedding projection or cost against quality. Either
 * axis can be linear, log or symlog, points can be selected, and a coordinate range can be drawn by dragging or set
 * with two range sliders. The application computes positions, and the plot never infers similarity or causation.
 */
export function ScatterPlot(props: ScatterPlotProps): ReactNode {
  const {
    points,
    x,
    y,
    referenceDiagonal,
    referenceLines = [],
    frontier = [],
    labeledIds = [],
    range,
    onRangeChange,
    rangeStep,
    selected,
    onSelectedChange,
    height = 'regular',
    ...figure
  } = props;

  const { emptyLabel = 'No points were supplied.', ...frame } = figure;
  const { locale, title } = frame;
  const readoutId = useId();
  const size = usePlotSize(height);
  const tones = useTones();
  const link = useLinkedInspection();
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const releaseDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => releaseDrag.current?.(), []);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const xDomain = x.domain ?? fitDomain({ values: points.map((point) => point.x), scale: x.scale });
  const yDomain = y.domain ?? fitDomain({ values: points.map((point) => point.y), scale: y.scale });

  const problem =
    scatterProblem({ points, x, y, xDomain, yDomain, range, onRangeChange, rangeStep }) ??
    (referenceLines.length > 0 ? validateReferenceLines({ lines: referenceLines, domain: yDomain }) : undefined);

  const selectedRange = range ?? null;

  if (problem !== undefined) {
    return <FigureInvalid {...frame} message={problem} />;
  }

  const plot = numericPlot({ width: size.width, height: size.height, x, y, xDomain, yDomain, locale });
  const { box } = plot;

  function xText(value: number): string {
    return formatValue({ value, locale, format: x.format });
  }

  function yText(value: number): string {
    return formatValue({ value, locale, format: y.format });
  }

  const items = points.map((point) => ({
    id: point.id,
    label: `${point.label}, ${x.label}: ${xText(point.x)}, ${y.label}: ${yText(point.y)}`,
  }));

  const drawn = points.map((point, index) => ({
    ...point,
    tone: tones({ id: point.id, tone: point.tone, index }),
    left: plot.x.position(point.x),
    top: plot.y.position(point.y),
  }));

  const places = new Map(
    drawn.map((point) => [point.id, { left: point.left, top: point.top, right: point.left, bottom: point.top }]),
  );

  const shownRange: ScatterRange | null | undefined =
    gesture === null
      ? range
      : { x: ordered(gesture.start.x, gesture.end.x), y: ordered(gesture.start.y, gesture.end.y) };

  function coordinate(svg: SVGSVGElement, clientX: number, clientY: number): Coordinate {
    const rectangle = svg.getBoundingClientRect();
    const left = ((clientX - rectangle.left) / rectangle.width) * box.width;
    const top = ((clientY - rectangle.top) / rectangle.height) * box.height;

    return {
      x: plot.x.valueAt(Math.min(box.right, Math.max(box.left, left))),
      y: plot.y.valueAt(Math.min(box.bottom, Math.max(box.top, top))),
    };
  }

  function begin(event: PointerEvent<SVGSVGElement>): void {
    // Touch gestures scroll the page; the range sliders own touch selection.
    const isBrushPress = event.button === 0 && event.pointerType !== 'touch';
    const svg = event.currentTarget;
    const container = svg.parentElement;
    const isOnBrush = event.target instanceof Element && event.target.closest('[data-brush]') !== null;

    const isBrushStart = isBrushPress && isOnBrush;

    if (onRangeChange === undefined || releaseDrag.current !== null || !isBrushStart) {
      return;
    }

    if (container === null) {
      return;
    }

    const start = coordinate(svg, event.clientX, event.clientY);

    setGesture({ start, end: start });

    releaseDrag.current = bindDrag(container, event.nativeEvent, {
      cancelOnEscape: true,
      onMove: ({ x: clientX, y: clientY }) => setGesture({ start, end: coordinate(svg, clientX, clientY) }),
      onEnd: (up, isCanceled) => {
        releaseDrag.current = null;

        setGesture(null);

        if (isCanceled) {
          return;
        }

        const end = coordinate(svg, up.clientX, up.clientY);
        const drawnRange: ScatterRange = { x: ordered(start.x, end.x), y: ordered(start.y, end.y) };

        dispatch({ options: () => props }, 'onRangeChange', drawnRange, { reason: 'drag', event: up });
      },
    });
  }

  const byId = new Map(drawn.map((point) => [point.id, point]));

  const frontierPoints = frontier
    .map((id) => byId.get(id))
    .filter((point): point is NonNullable<typeof point> => point !== undefined);

  const frontierPath =
    frontierPoints.length >= 2 ? linePath(frontierPoints.map((point) => ({ x: point.left, y: point.top }))) : '';

  const labeledSet = new Set(labeledIds);

  const diagonalSpec: ScatterDiagonal | null =
    referenceDiagonal === true
      ? { label: 'y = x' }
      : referenceDiagonal === false || referenceDiagonal === undefined
        ? null
        : referenceDiagonal;

  const diagLow = Math.max(xDomain[0], yDomain[0]);
  const diagHigh = Math.min(xDomain[1], yDomain[1]);
  const hasDiagonal = diagonalSpec !== null && diagHigh > diagLow;

  return (
    <Chart
      {...link}
      items={items}
      place={(id) => places.get(id)}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          footer={<ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>}
        >
          {points.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <PlotSurface
              plotRef={size.ref}
              box={box}
              label={plotLabel({ title, isSelectable: onSelectedChange !== undefined })}
              readoutId={readoutId}
              onPointerDown={begin}
              overlay={drawn.map((point, index) => (
                <ChartMark
                  key={point.id}
                  value={point.id}
                  render={
                    <button
                      type="button"
                      tabIndex={-1}
                      title={point.label}
                      aria-label={items[index]?.label}
                      aria-pressed={onSelectedChange === undefined ? undefined : selected === point.id}
                    />
                  }
                  {...stylex.props(styles.target, styles.location(point.left, point.top))}
                >
                  <span aria-hidden {...stylex.props(styles.ring, cursor === point.id && chartStyles.cursor)} />
                </ChartMark>
              ))}
            >
              <PlotAxes
                box={box}
                xTicks={plot.xTicks}
                yTicks={plot.yTicks}
                xTitle={axisTitle(x)}
                yTitle={axisTitle(y)}
                grid="both"
              />
              {onRangeChange !== undefined && (
                <rect
                  data-brush=""
                  x={box.left}
                  y={box.top}
                  width={box.innerWidth}
                  height={box.innerHeight}
                  {...stylex.props(styles.brush)}
                />
              )}
              <PlotClip box={box} pad={6}>
                {hasDiagonal && <DiagonalMarks spec={diagonalSpec} low={diagLow} high={diagHigh} plot={plot} />}
                {referenceLines.length > 0 && (
                  <ReferenceMarks lines={referenceLines} box={box} position={plot.y.position} valueText={yText} />
                )}
                {frontierPath !== '' && <LineMark d={frontierPath} tone="series1" stroke="dashed" />}
                {shownRange !== null && shownRange !== undefined && <RangeMark range={shownRange} plot={plot} />}
                {drawn.map((point) => (
                  <DotMark
                    key={point.id}
                    mark={point.id}
                    x={point.left}
                    y={point.top}
                    tone={point.tone}
                    isInspected={inspected === point.id}
                    isSelected={selected === point.id}
                  />
                ))}
                {drawn
                  .filter((point) => labeledSet.has(point.id))
                  .map((point) => {
                    const isNearRight = point.left > box.right - 90;
                    const isNearTop = point.top < box.top + 18;

                    return (
                      <LabelMark
                        key={`label-${point.id}`}
                        x={point.left + (isNearRight ? -8 : 8)}
                        y={point.top + (isNearTop ? 14 : -6)}
                        anchor={isNearRight ? 'end' : 'start'}
                      >
                        {point.label}
                      </LabelMark>
                    );
                  })}
              </PlotClip>
            </PlotSurface>
          )}
          {onRangeChange !== undefined && rangeStep !== undefined && (
            <RangeControls
              x={x}
              y={y}
              xDomain={xDomain}
              yDomain={yDomain}
              range={selectedRange}
              rangeStep={rangeStep}
              locale={locale}
              onRangeChange={onRangeChange}
            />
          )}
          <ChartData
            label={`${title} points`}
            columns={[
              { id: 'point', label: 'Point' },
              { id: 'x', label: x.label },
              { id: 'y', label: y.label },
            ]}
            rows={points.map((point) => ({ id: point.id, values: [point.label, xText(point.x), yText(point.y)] }))}
          />
        </FigureFrame>
      )}
    />
  );
}

function DiagonalMarks({
  spec,
  low,
  high,
  plot,
}: {
  readonly spec: ScatterDiagonal;
  readonly low: number;
  readonly high: number;
  readonly plot: NumericPlotLayout;
}): ReactNode {
  const { box } = plot;
  const x2 = plot.x.position(high);
  const y2 = plot.y.position(high);

  return (
    <g>
      <line x1={plot.x.position(low)} y1={plot.y.position(low)} x2={x2} y2={y2} {...stylex.props(styles.diagonal)} />
      {spec.label !== undefined && (
        <LabelMark x={x2 - 6} y={y2 + 14} anchor="end">
          {spec.label}
        </LabelMark>
      )}
      {spec.aboveLabel !== undefined && (
        <text x={box.left + 8} y={box.top + 14} {...stylex.props(styles.regionLabel)}>
          {spec.aboveLabel}
        </text>
      )}
      {spec.belowLabel !== undefined && (
        <text x={box.right - 8} y={box.bottom - 8} textAnchor="end" {...stylex.props(styles.regionLabel)}>
          {spec.belowLabel}
        </text>
      )}
    </g>
  );
}

function RangeMark({ range, plot }: { readonly range: ScatterRange; readonly plot: NumericPlotLayout }): ReactNode {
  const left = plot.x.position(range.x[0]);
  const top = plot.y.position(range.y[1]);

  return (
    <rect
      x={left}
      y={top}
      width={plot.x.position(range.x[1]) - left}
      height={plot.y.position(range.y[0]) - top}
      {...stylex.props(styles.range)}
    />
  );
}

type RangeControlsProps = {
  readonly x: PlotAxis;
  readonly y: PlotAxis;
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
  readonly range: ScatterRange | null;
  readonly rangeStep: { readonly x: number; readonly y: number };
  readonly locale: string;
  readonly onRangeChange: NonNullable<ScatterPlotProps['onRangeChange']>;
};

function RangeSlider({
  axis,
  domain,
  value,
  step,
  locale,
  onChange,
}: {
  readonly axis: PlotAxis;
  readonly domain: NumericDomain;
  readonly value: NumericDomain;
  readonly step: number;
  readonly locale: string;
  readonly onChange: (value: NumericDomain, details: SliderDetails) => void;
}): ReactNode {
  function text(bound: number): string {
    return formatValue({ value: bound, locale, format: axis.format });
  }

  return (
    <Slider.Root<[number, number]>
      value={[...value]}
      format={axis.format}
      min={domain[0]}
      max={domain[1]}
      step={step}
      locale={locale}
      onValueChange={(bounds, details) => onChange(bounds, details)}
    >
      <div {...stylex.props(styles.rangeTitle)}>
        <Slider.Label>{axis.label}</Slider.Label>
        <span>
          {text(value[0])} – {text(value[1])}
        </span>
      </div>
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb index={0} aria-label={`${axis.label} minimum`} />
          <Slider.Thumb index={1} aria-label={`${axis.label} maximum`} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function RangeControls({
  x,
  y,
  xDomain,
  yDomain,
  range,
  rangeStep,
  locale,
  onRangeChange,
}: RangeControlsProps): ReactNode {
  const value = range ?? { x: xDomain, y: yDomain };

  return (
    <fieldset {...stylex.props(styles.rangeControls)}>
      <legend {...stylex.props(styles.legend)}>
        Drag with a mouse, or adjust these bounds to select a coordinate range.
      </legend>
      <RangeSlider
        axis={x}
        domain={xDomain}
        value={value.x}
        step={rangeStep.x}
        locale={locale}
        onChange={(bounds, details) => onRangeChange({ x: bounds, y: value.y }, details)}
      />
      <RangeSlider
        axis={y}
        domain={yDomain}
        value={value.y}
        step={rangeStep.y}
        locale={locale}
        onChange={(bounds, details) => onRangeChange({ x: value.x, y: bounds }, details)}
      />
      <TextButton
        type="button"
        disabled={range === null}
        onClick={(event) => {
          dispatch({ options: () => ({ onRangeChange }) }, 'onRangeChange', null, {
            reason: 'clear-press',
            event: event.nativeEvent,
          });
        }}
      >
        Clear range
      </TextButton>
    </fieldset>
  );
}
