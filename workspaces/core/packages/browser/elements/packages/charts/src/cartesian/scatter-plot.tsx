import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { useId, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { TextButton } from '../../../core/src/index.ts';
import { Slider } from '../../../forms/src/index.ts';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';
import { useChartNavigation } from '../chart-navigation.tsx';
import { chartStyles } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';

export type ScatterPoint = {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly tone: ChartTone;
};

export type ScatterRange = { readonly x: readonly [number, number]; readonly y: readonly [number, number] };

export type ScatterRangeSelection = {
  readonly value: ScatterRange | null;
  readonly onChange: (range: ScatterRange | null) => void;
  readonly xStep: number;
  readonly yStep: number;
  readonly locale: string;
};

export type ScatterPlotProps = {
  readonly title: string;
  readonly report?: ChartReport | undefined;
  readonly description: string;
  readonly points: ReadonlyArray<ScatterPoint>;
  readonly xDomain: readonly [number, number];
  readonly yDomain: readonly [number, number];
  readonly xLabel: string;
  readonly yLabel: string;
  readonly formatX: (value: number) => string;
  readonly formatY: (value: number) => string;
  readonly selection?: ChartSelection | undefined;
  readonly rangeSelection?: ScatterRangeSelection | undefined;
  readonly emptyLabel: string;
};

type Coordinate = { readonly x: number; readonly y: number };
type Gesture = { readonly start: Coordinate; readonly end: Coordinate; readonly pointerId: number };

const PLOT_HEIGHT = 260;
const LEFT_MARGIN = 56;
const RIGHT_MARGIN = 20;
const TOP_MARGIN = 12;
const BOTTOM_MARGIN = 44;
const POINT_TARGET = 44;
export const MAX_SCATTER_POINTS = 1000;

const styles = stylex.create({
  plot: { position: 'relative', minWidth: 0 },
  marks: { position: 'absolute', inset: 0, clipPath: 'inset(12px 20px 44px 56px)', pointerEvents: 'none' },
  brush: { touchAction: 'pan-y', cursor: 'crosshair' },
  range: {
    fill: colors.focus,
    fillOpacity: 0.08,
    stroke: colors.focus,
    strokeWidth: 1,
    strokeDasharray: '4 3',
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
  dot: (color: string) => ({ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }),
  selected: { outlineWidth: controls.focusWidth, outlineColor: colors.ink, outlineStyle: 'solid', outlineOffset: 3 },
  values: { minWidth: 0, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', color: colors.muted },
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
  empty: { margin: 0, color: colors.muted },
});

export function ScatterPlot(props: ScatterPlotProps): ReactNode {
  const {
    title,
    report,
    description,
    points,
    xDomain,
    yDomain,
    xLabel,
    yLabel,
    formatX,
    formatY,
    selection,
    rangeSelection,
    emptyLabel,
  } = props;

  const navigation = useChartNavigation({
    title,
    selection,
    items: points.map((point) => ({
      id: point.id,
      label: `${point.label}, ${xLabel}: ${formatX(point.x)}, ${yLabel}: ${formatY(point.y)}`,
    })),
  });

  const { ref, width } = usePlotWidth();
  const problem = scatterProblem(props);

  if (problem !== null) {
    return <ChartInputError title={title} report={report} description={description} message={problem} />;
  }

  const scaleX = scaleLinear({
    domain: [...xDomain],
    range: [LEFT_MARGIN, Math.max(LEFT_MARGIN, width - RIGHT_MARGIN)],
  });

  const scaleY = scaleLinear({ domain: [...yDomain], range: [PLOT_HEIGHT - BOTTOM_MARGIN, TOP_MARGIN] });

  return (
    <ChartFrame
      title={title}
      report={report}
      description={description}
      footer={<ChartReadout id={navigation.id}>{navigation.label ?? '\u00A0'}</ChartReadout>}
    >
      {points.length === 0 ? (
        <p {...stylex.props(styles.empty)}>{emptyLabel}</p>
      ) : (
        <div ref={ref} {...navigation.props} {...stylex.props(styles.plot)}>
          <ScatterCanvas
            key={`${xDomain[0]}:${xDomain[1]}:${yDomain[0]}:${yDomain[1]}:${width}`}
            width={width}
            scaleX={scaleX}
            scaleY={scaleY}
            {...props}
          />
          {points.length > 0 && (
            <div {...stylex.props(styles.marks)}>
              {points.map((point) => {
                const isInspected = navigation.label !== undefined && navigation.activeId === point.id;

                return (
                  <button
                    key={point.id}
                    type="button"
                    tabIndex={-1}
                    onPointerEnter={() => navigation.inspect(point.id)}
                    title={point.label}
                    aria-label={`${point.label}, ${xLabel}: ${formatX(point.x)}, ${yLabel}: ${formatY(point.y)}`}
                    aria-pressed={selection === undefined ? undefined : selection.selectedId === point.id}
                    onClick={() => {
                      navigation.inspect(point.id);
                      selection?.onSelect(point.id);
                    }}
                    {...stylex.props(styles.target, styles.location(scaleX(point.x), scaleY(point.y)))}
                  >
                    <span
                      aria-hidden
                      {...stylex.props(
                        styles.dot(chartToneColors[point.tone]),
                        (selection?.selectedId === point.id || isInspected) && styles.selected,
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {rangeSelection !== undefined && <RangeControls {...props} rangeSelection={rangeSelection} />}
      <ChartData
        label={`${title} points`}
        columns={[
          { id: 'point', label: 'Point' },
          { id: 'x', label: xLabel },
          { id: 'y', label: yLabel },
        ]}
        rows={points.map((point) => ({ id: point.id, values: [point.label, formatX(point.x), formatY(point.y)] }))}
      />
    </ChartFrame>
  );
}

function ScatterCanvas({
  width,
  scaleX,
  scaleY,
  xLabel,
  yLabel,
  formatX,
  formatY,
  rangeSelection,
}: ScatterPlotProps & {
  readonly width: number;
  readonly scaleX: ReturnType<typeof scaleLinear<number>>;
  readonly scaleY: ReturnType<typeof scaleLinear<number>>;
}): ReactNode {
  const clipId = useId();
  const [gesture, setGesture] = useState<Gesture | null>(null);

  const range: ScatterRange | null | undefined =
    gesture === null
      ? rangeSelection?.value
      : {
          x: [Math.min(gesture.start.x, gesture.end.x), Math.max(gesture.start.x, gesture.end.x)],
          y: [Math.min(gesture.start.y, gesture.end.y), Math.max(gesture.start.y, gesture.end.y)],
        };

  function coordinate(event: PointerEvent<SVGSVGElement>): Coordinate {
    const rectangle = event.currentTarget.getBoundingClientRect();

    return {
      x: scaleX
        .copy()
        .clamp(true)
        .invert(((event.clientX - rectangle.left) / rectangle.width) * width),
      y: scaleY
        .copy()
        .clamp(true)
        .invert(((event.clientY - rectangle.top) / rectangle.height) * PLOT_HEIGHT),
    };
  }

  function begin(event: PointerEvent<SVGSVGElement>): void {
    // Touch gestures scroll the page; range sliders own touch selection.
    if (rangeSelection === undefined || event.button !== 0 || event.pointerType === 'touch') {
      return;
    }

    const rectangle = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rectangle.left) / rectangle.width) * width;
    const y = ((event.clientY - rectangle.top) / rectangle.height) * PLOT_HEIGHT;

    const isOutsideHorizontalBounds = x < LEFT_MARGIN || x > width - RIGHT_MARGIN;
    const isOutsideVerticalBounds = y < TOP_MARGIN || y > PLOT_HEIGHT - BOTTOM_MARGIN;

    if (isOutsideHorizontalBounds || isOutsideVerticalBounds) {
      return;
    }

    const point = coordinate(event);

    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({ start: point, end: point, pointerId: event.pointerId });
  }

  function move(event: PointerEvent<SVGSVGElement>): void {
    if (gesture === null || gesture.pointerId !== event.pointerId) {
      return;
    }

    setGesture({ ...gesture, end: coordinate(event) });
  }

  function finish(event: PointerEvent<SVGSVGElement>): void {
    if (gesture === null || gesture.pointerId !== event.pointerId) {
      return;
    }

    const end = coordinate(event);

    const nextRange: ScatterRange = {
      x: [Math.min(gesture.start.x, end.x), Math.max(gesture.start.x, end.x)],
      y: [Math.min(gesture.start.y, end.y), Math.max(gesture.start.y, end.y)],
    };

    setGesture(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    rangeSelection?.onChange(nextRange);
  }

  return (
    <svg
      width={width}
      height={PLOT_HEIGHT}
      viewBox={`0 0 ${width} ${PLOT_HEIGHT}`}
      aria-hidden
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={() => setGesture(null)}
      onLostPointerCapture={() => setGesture(null)}
      {...stylex.props(chartStyles.svg, rangeSelection !== undefined && styles.brush)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={LEFT_MARGIN}
            y={TOP_MARGIN}
            width={Math.max(0, width - LEFT_MARGIN - RIGHT_MARGIN)}
            height={PLOT_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN}
          />
        </clipPath>
      </defs>
      {scaleX.ticks(5).map((tick) => (
        <g key={tick}>
          <line
            x1={scaleX(tick)}
            x2={scaleX(tick)}
            y1={TOP_MARGIN}
            y2={PLOT_HEIGHT - BOTTOM_MARGIN}
            {...stylex.props(chartStyles.grid)}
          />
          <text
            x={scaleX(tick)}
            y={PLOT_HEIGHT - BOTTOM_MARGIN + 18}
            textAnchor="middle"
            {...stylex.props(chartStyles.label)}
          >
            {formatX(tick)}
          </text>
        </g>
      ))}
      {scaleY.ticks(4).map((tick) => (
        <g key={tick}>
          <line
            x1={LEFT_MARGIN}
            x2={width - RIGHT_MARGIN}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            {...stylex.props(chartStyles.grid)}
          />
          <text x={LEFT_MARGIN - 8} y={scaleY(tick) + 4} textAnchor="end" {...stylex.props(chartStyles.label)}>
            {formatY(tick)}
          </text>
        </g>
      ))}
      <text
        x={(LEFT_MARGIN + width - RIGHT_MARGIN) / 2}
        y={PLOT_HEIGHT - 4}
        textAnchor="middle"
        {...stylex.props(chartStyles.label)}
      >
        {xLabel}
      </text>
      <text
        x={12}
        y={(PLOT_HEIGHT - BOTTOM_MARGIN) / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${(PLOT_HEIGHT - BOTTOM_MARGIN) / 2})`}
        {...stylex.props(chartStyles.label)}
      >
        {yLabel}
      </text>
      <g clipPath={`url(#${clipId})`}>
        {range !== null && range !== undefined && (
          <rect
            x={scaleX(range.x[0])}
            y={scaleY(range.y[1])}
            width={scaleX(range.x[1]) - scaleX(range.x[0])}
            height={scaleY(range.y[0]) - scaleY(range.y[1])}
            {...stylex.props(styles.range)}
          />
        )}
      </g>
    </svg>
  );
}

function RangeControls({
  rangeSelection,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  formatX,
  formatY,
}: ScatterPlotProps & { readonly rangeSelection: ScatterRangeSelection }): ReactNode {
  const value = rangeSelection.value ?? { x: xDomain, y: yDomain };

  return (
    <fieldset {...stylex.props(styles.rangeControls)}>
      <legend {...stylex.props(styles.legend)}>
        Drag with a mouse, or adjust these bounds to select a coordinate range.
      </legend>
      <Slider.Root
        value={value.x}
        min={xDomain[0]}
        max={xDomain[1]}
        step={rangeSelection.xStep}
        locale={rangeSelection.locale}
        thumbCollisionBehavior="none"
        onValueChange={(x) => rangeSelection.onChange({ x, y: value.y })}
      >
        <div {...stylex.props(styles.rangeTitle)}>
          <Slider.Label>{xLabel}</Slider.Label>
          <span>
            {formatX(value.x[0])} – {formatX(value.x[1])}
          </span>
        </div>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            <Slider.Thumb
              index={0}
              aria-label={`${xLabel} minimum`}
              getAriaValueText={(_, number) => formatX(number)}
            />
            <Slider.Thumb
              index={1}
              aria-label={`${xLabel} maximum`}
              getAriaValueText={(_, number) => formatX(number)}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <Slider.Root
        value={value.y}
        min={yDomain[0]}
        max={yDomain[1]}
        step={rangeSelection.yStep}
        locale={rangeSelection.locale}
        thumbCollisionBehavior="none"
        onValueChange={(y) => rangeSelection.onChange({ x: value.x, y })}
      >
        <div {...stylex.props(styles.rangeTitle)}>
          <Slider.Label>{yLabel}</Slider.Label>
          <span>
            {formatY(value.y[0])} – {formatY(value.y[1])}
          </span>
        </div>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            <Slider.Thumb
              index={0}
              aria-label={`${yLabel} minimum`}
              getAriaValueText={(_, number) => formatY(number)}
            />
            <Slider.Thumb
              index={1}
              aria-label={`${yLabel} maximum`}
              getAriaValueText={(_, number) => formatY(number)}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <TextButton type="button" disabled={rangeSelection.value === null} onClick={() => rangeSelection.onChange(null)}>
        Clear range
      </TextButton>
    </fieldset>
  );
}

function scatterProblem({ points, xDomain, yDomain, rangeSelection }: ScatterPlotProps): string | null {
  if (!isFiniteDomain(xDomain) || !isFiniteDomain(yDomain)) {
    return 'Scatter domains must contain finite, increasing endpoints.';
  }

  if (points.length > MAX_SCATTER_POINTS) {
    return `This plot exceeds the ${MAX_SCATTER_POINTS}-point render limit. Supply a smaller, labelled sample.`;
  }

  if (!hasUniqueIds(points)) {
    return 'Scatter points must have unique identifiers.';
  }

  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return 'Scatter coordinates must be finite.';
  }

  if (
    points.some((point) => {
      const isOutsideXDomain = point.x < xDomain[0] || point.x > xDomain[1];
      const isOutsideYDomain = point.y < yDomain[0] || point.y > yDomain[1];

      return isOutsideXDomain || isOutsideYDomain;
    })
  ) {
    return 'Scatter coordinates fall outside the declared domain. Widen the domain or supply a labelled window of points.';
  }

  if (rangeSelection === undefined) {
    return null;
  }

  const isValidXStep =
    Number.isFinite(rangeSelection.xStep) &&
    rangeSelection.xStep > 0 &&
    rangeSelection.xStep <= xDomain[1] - xDomain[0];

  const isValidYStep =
    Number.isFinite(rangeSelection.yStep) &&
    rangeSelection.yStep > 0 &&
    rangeSelection.yStep <= yDomain[1] - yDomain[0];

  if (!isValidXStep || !isValidYStep) {
    return 'Range selection steps must be finite, positive, and no larger than their domain span.';
  }

  const range = rangeSelection.value;

  if (range === null) {
    return null;
  }

  if (!isRangeWithinDomain(range.x, xDomain) || !isRangeWithinDomain(range.y, yDomain)) {
    return 'The selected range must have finite, ordered bounds inside the declared domain.';
  }

  return null;
}

function isRangeWithinDomain(range: readonly [number, number], domain: readonly [number, number]): boolean {
  if (!range.every(Number.isFinite) || range[0] > range[1]) {
    return false;
  }

  return range[0] >= domain[0] && range[1] <= domain[1];
}
