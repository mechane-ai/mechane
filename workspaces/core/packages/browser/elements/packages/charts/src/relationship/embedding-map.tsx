import * as stylex from '@stylexjs/stylex';
import { bindDrag, dispatch } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { TextButton } from '../../../core/src/index.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartLegend, ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle, fitDomain, numericPlot } from '../plot/plot-layout.ts';
import type { NumericPlotLayout, PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, LabelMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { countInside, hitIndex } from '../plot/render/hit-index.ts';
import type { DataRect, HitIndex } from '../plot/render/hit-index.ts';
import { PlotViewportRoot, PlotViewportSurface, visibleDomains, WHOLE_VIEW } from '../plot/render/plot-viewport.tsx';
import type { PlotView } from '../plot/render/plot-viewport.tsx';
import { PointLayer } from '../plot/render/point-layer.tsx';
import type { PointRenderer } from '../plot/render/point-layer.tsx';
import { columnExtent, outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';

/**
 * The items of a map as plain columns, already projected by the application. The nth item sits at `x[n]`, `y[n]` and
 * belongs to the group at index `group[n]`. The `ids` column names each item for the readout, or leave it out to number
 * them.
 */
export type EmbeddingPoints = {
  readonly ids?: ReadonlyArray<string> | undefined;
  readonly x: ReadonlyArray<number>;
  readonly y: ReadonlyArray<number>;
  readonly group: ReadonlyArray<number>;
};

/** A group of items, such as a cluster, a class or a source. Its hue marks its items and its legend entry. */
export type EmbeddingGroup = { readonly id: string; readonly label: string; readonly tone?: ChartTone | undefined };

/** A named place on the map, drawn as a label: a cluster name, a probe or the item a reader is studying. */
export type EmbeddingLandmark = { readonly id: string; readonly label: string; readonly x: number; readonly y: number };

/**
 * How the map draws its items. `auto` uses canvas 2D up to `embeddingLimits.canvasPoints` and WebGL beyond. Without
 * WebGL the map draws with canvas 2D, a frame at a time, and says so.
 */
export type EmbeddingRenderer = 'auto' | PointRenderer;

/** A rectangle on the map in data units, such as the area a reader drew. */
export type EmbeddingRange = DataRect;

/** Why the range changed, and how many items lie inside the requested range. */
export type EmbeddingRangeDetails = ChangeDetails<'drag' | 'clear-press' | 'trigger-press'> & {
  readonly count: number;
};

export type EmbeddingMapProps = FigureProps &
  FigureSelectionProps & {
    readonly points: EmbeddingPoints;
    readonly groups: ReadonlyArray<EmbeddingGroup>;
    /** The projection's axes. Both are linear; leave the domains out to fit the items. */
    readonly x: PlotAxis;
    readonly y: PlotAxis;
    readonly landmarks?: ReadonlyArray<EmbeddingLandmark> | undefined;
    readonly renderer?: EmbeddingRenderer | undefined;
    /** The rectangle the reader drew, or null. Supply `onRangeChange` to let a drag draw one. */
    readonly range?: EmbeddingRange | null | undefined;
    readonly onRangeChange?: ((range: EmbeddingRange | null, details: EmbeddingRangeDetails) => void) | undefined;
    /**
     * Lets the reader pan and zoom: a drag pans, and a pinch or Control or Command with a scroll zooms. The keys `+`,
     * `−` and `0` zoom from the keyboard, and Shift with a drag draws the range. A plain scroll always scrolls the
     * page.
     */
    readonly isExplorable?: boolean | undefined;
    readonly height?: PlotHeight | undefined;
  };

/** The largest map each renderer draws, from draw times measured in headless Chromium. */
export const embeddingLimits = { canvasPoints: 100_000, webglPoints: 1_000_000, groups: 12, landmarks: 200 } as const;

const HOVER_RADIUS = 10;
const LANDMARK_RADIUS = 3;
const LABEL_GAP = 6;
const LABEL_HEIGHT = 14;
const LABEL_BASELINE = 4;
const CHARACTER_WIDTH = 7;
const CURSOR_PAD = 4;
const DENSE = { points: 100_000, radius: 1, opacity: 0.4 } as const;
const MEDIUM = { points: 10_000, radius: 1.5, opacity: 0.55 } as const;
const SPARSE = { radius: 2.5, opacity: 0.8 } as const;
const wholeNumber = { maximumFractionDigits: 0 } as const;
const share = { style: 'percent', maximumFractionDigits: 1 } as const;

const styles = stylex.create({
  surface: (left: number, top: number) => ({ position: 'absolute', left, top, pointerEvents: 'auto' }),
  size: (width: number, height: number) => ({ width, height }),
  explore: { touchAction: 'none', cursor: 'grab' },
  brush: { touchAction: 'pan-y', cursor: 'crosshair' },
  inspect: { touchAction: 'pan-y' },
  layer: { position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' },
  landmark: { pointerEvents: 'auto', cursor: 'pointer' },
  range: {
    fill: colors.focus,
    fillOpacity: 0.08,
    stroke: colors.focus,
    strokeWidth: 1,
    strokeDasharray: '4 3',
    vectorEffect: 'non-scaling-stroke',
  },
  cursorBox: { fill: 'none' },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    minWidth: 0,
    marginBlockStart: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
});

type EmbeddingSummary = {
  readonly error: string | undefined;
  readonly xExtent: NumericDomain | undefined;
  readonly yExtent: NumericDomain | undefined;
  /** Items per group, by group index. */
  readonly counts: ReadonlyArray<number>;
  /** The data rectangle each group's items span, by group index. */
  readonly extents: ReadonlyArray<DataRect | undefined>;
  readonly index: HitIndex | undefined;
};

/** Reads every item once: the checks that need each value, the extents, the group counts and the hit index. */
function summarize(points: EmbeddingPoints, groupCount: number): EmbeddingSummary {
  const count = points.x.length;
  const none = { xExtent: undefined, yExtent: undefined, counts: [], extents: [], index: undefined };

  if (points.y.length !== count || points.group.length !== count) {
    return { ...none, error: 'The x, y and group columns must have one value per item.' };
  }

  if (count > embeddingLimits.webglPoints) {
    return {
      ...none,
      error: `This map draws at most ${embeddingLimits.webglPoints} items. Supply a sample and declare its coverage.`,
    };
  }

  if (points.ids !== undefined && (points.ids.length !== count || new Set(points.ids).size !== count)) {
    return { ...none, error: 'Item ids must name every item once.' };
  }

  const bounds = Float64Array.from({ length: groupCount * 4 }, (_, slot) =>
    slot % 2 === 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY,
  );

  const counts = new Int32Array(groupCount);
  const problem = { index: -1 };

  for (const [index, group] of points.group.entries()) {
    const x = points.x[index] ?? Number.NaN;
    const y = points.y[index] ?? Number.NaN;
    const isKnownGroup = Number.isInteger(group) && group >= 0 && group < groupCount;

    if (!isKnownGroup || !Number.isFinite(x) || !Number.isFinite(y)) {
      problem.index = index;

      break;
    }

    counts[group] = (counts[group] ?? 0) + 1;
    bounds[group * 4] = Math.min(bounds[group * 4] ?? x, x);
    bounds[group * 4 + 1] = Math.max(bounds[group * 4 + 1] ?? x, x);
    bounds[group * 4 + 2] = Math.min(bounds[group * 4 + 2] ?? y, y);
    bounds[group * 4 + 3] = Math.max(bounds[group * 4 + 3] ?? y, y);
  }

  if (problem.index >= 0) {
    return {
      ...none,
      error: `Item ${points.ids?.[problem.index] ?? problem.index} needs finite coordinates and a group index between 0 and ${groupCount - 1}.`,
    };
  }

  const xExtent = columnExtent(points.x);
  const yExtent = columnExtent(points.y);

  const extents = Array.from(counts, (groupItems, group): DataRect | undefined =>
    groupItems === 0
      ? undefined
      : {
          x: [bounds[group * 4] ?? 0, bounds[group * 4 + 1] ?? 0],
          y: [bounds[group * 4 + 2] ?? 0, bounds[group * 4 + 3] ?? 0],
        },
  );

  const index =
    xExtent === undefined || yExtent === undefined
      ? undefined
      : hitIndex({ points, domain: { x: paddedDomain(xExtent), y: paddedDomain(yExtent) } });

  return { error: undefined, xExtent, yExtent, counts: Array.from(counts), extents, index };
}

function paddedDomain(extent: NumericDomain): NumericDomain {
  return extent[0] === extent[1] ? [extent[0] - 1, extent[1] + 1] : extent;
}

function inside(rect: DataRect, domain: DataRect): boolean {
  const isOrdered = rect.x[0] <= rect.x[1] && rect.y[0] <= rect.y[1];
  const isXInside = !outsideDomain(rect.x[0], domain.x) && !outsideDomain(rect.x[1], domain.x);
  const isYInside = !outsideDomain(rect.y[0], domain.y) && !outsideDomain(rect.y[1], domain.y);

  return isOrdered && isXInside && isYInside;
}

function embeddingInputError({
  summary,
  groups,
  landmarks,
  x,
  y,
  domain,
  range,
  renderer,
  count,
}: {
  readonly summary: EmbeddingSummary;
  readonly groups: ReadonlyArray<EmbeddingGroup>;
  readonly landmarks: ReadonlyArray<EmbeddingLandmark>;
  readonly x: PlotAxis;
  readonly y: PlotAxis;
  readonly domain: DataRect;
  readonly range: EmbeddingRange | null;
  readonly renderer: EmbeddingRenderer;
  readonly count: number;
}): string | undefined {
  const isXLinear = (x.scale ?? 'linear') === 'linear';
  const isYLinear = (y.scale ?? 'linear') === 'linear';

  if (!isXLinear || !isYLinear) {
    return 'An embedding map draws projected coordinates on linear axes.';
  }

  const domainError = scaleDomainError(domain.x) ?? scaleDomainError(domain.y);

  if (domainError !== undefined) {
    return domainError;
  }

  if (groups.length > embeddingLimits.groups || landmarks.length > embeddingLimits.landmarks) {
    return `This map draws at most ${embeddingLimits.groups} groups and ${embeddingLimits.landmarks} landmarks.`;
  }

  if (!hasUniqueIds([...groups, ...landmarks])) {
    return 'Groups and landmarks must have unique identifiers, distinct from each other.';
  }

  if (renderer === 'canvas' && count > embeddingLimits.canvasPoints) {
    return `Canvas draws at most ${embeddingLimits.canvasPoints} items. Use the WebGL or automatic renderer.`;
  }

  if (summary.error !== undefined) {
    return summary.error;
  }

  const { xExtent, yExtent } = summary;

  if (xExtent !== undefined && yExtent !== undefined && !inside({ x: xExtent, y: yExtent }, domain)) {
    return 'An item lies outside the declared domain.';
  }

  if (landmarks.some((landmark) => !inside({ x: [landmark.x, landmark.x], y: [landmark.y, landmark.y] }, domain))) {
    return 'A landmark needs finite coordinates inside the declared domain.';
  }

  if (range !== null && !inside(range, domain)) {
    return 'The range needs finite, ordered bounds inside the declared domain.';
  }

  return undefined;
}

function density(count: number): { readonly radius: number; readonly opacity: number } {
  if (count > DENSE.points) {
    return DENSE;
  }

  return count > MEDIUM.points ? MEDIUM : SPARSE;
}

type PlacedLandmark = EmbeddingLandmark & {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly hasLabel: boolean;
};

/** Places landmarks in the visible plot, naming each one whose label does not cover a label placed before it. */
function placeLandmarks({
  landmarks,
  plot,
  first,
}: {
  readonly landmarks: ReadonlyArray<EmbeddingLandmark>;
  readonly plot: NumericPlotLayout;
  /** The landmarks whose labels win a collision: the selected and inspected ones. */
  readonly first: ReadonlyArray<string | null>;
}): ReadonlyArray<PlacedLandmark> {
  const { box } = plot;

  const visible = landmarks
    .map((landmark) => ({
      ...landmark,
      left: plot.x.position(landmark.x),
      top: plot.y.position(landmark.y),
      width: landmark.label.length * CHARACTER_WIDTH,
    }))
    .filter((place) => place.left >= box.left && place.left <= box.right)
    .filter((place) => place.top >= box.top && place.top <= box.bottom)
    .toSorted((one, other) => Number(first.includes(other.id)) - Number(first.includes(one.id)));

  const taken: Array<{ readonly left: number; readonly right: number; readonly top: number }> = [];

  return visible.map((place) => {
    const label = { left: place.left + LABEL_GAP, right: place.left + LABEL_GAP + place.width, top: place.top };
    const isInPlot = label.right <= box.right;

    const isClear = taken.every(
      (other) => label.right < other.left || label.left > other.right || Math.abs(label.top - other.top) > LABEL_HEIGHT,
    );

    if (isInPlot && isClear) {
      taken.push(label);
    }

    return { ...place, hasLabel: isInPlot && isClear };
  });
}

/**
 * A map of up to a million points colored by group, already placed in two dimensions by the application, such as a UMAP
 * of activations or embeddings. Readers step through the groups and named landmarks with the arrow keys, point at any
 * item to read it, and draw a rectangle to count the items inside. Pass `coverage` when the points are a sample, and
 * set `isExplorable` to let readers pan and zoom.
 */
export function EmbeddingMap(props: EmbeddingMapProps): ReactNode {
  const {
    points,
    groups,
    x,
    y,
    landmarks = [],
    renderer = 'auto',
    range = null,
    onRangeChange,
    isExplorable = false,
    height = 'tall',
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No items are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const tones = useTones();
  const link = useLinkedInspection();
  const [view, setView] = useState<PlotView>(WHOLE_VIEW);
  const [hovered, setHovered] = useState<number | null>(null);
  const [draft, setDraft] = useState<DataRect | null>(null);
  const [drawnWith, setDrawnWith] = useState<PointRenderer | null>(null);
  const releaseDrag = useRef<(() => void) | null>(null);

  // Reading a million items is the expensive step, so it runs only when the columns change.
  const summary = useMemo(
    () => summarize({ ids: points.ids, x: points.x, y: points.y, group: points.group }, groups.length),
    [points.ids, points.x, points.y, points.group, groups.length],
  );

  const rangeCount = useMemo(
    () => (range === null ? 0 : countInside({ x: points.x, y: points.y, group: points.group }, range)),
    [points.x, points.y, points.group, range],
  );

  useEffect(() => () => releaseDrag.current?.(), []);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const count = points.x.length;
  const xDomain = x.domain ?? fitDomain({ values: summary.xExtent ?? [] });
  const yDomain = y.domain ?? fitDomain({ values: summary.yExtent ?? [] });
  const domain = { x: xDomain, y: yDomain };
  const inputError = embeddingInputError({ summary, groups, landmarks, x, y, domain, range, renderer, count });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const layout = { width: size.width, height: size.height, x, y, locale };
  const whole = numericPlot({ ...layout, xDomain, yDomain });
  const shown = isExplorable ? visibleDomains({ view, box: whole.box, x: whole.x, y: whole.y }) : domain;
  const plot = isExplorable ? numericPlot({ ...layout, xDomain: shown.x, yDomain: shown.y }) : whole;
  const { box } = plot;
  const isWholeView = view.zoom === 1 && view.x === 0 && view.y === 0;
  const drawn = groups.map((group, index) => ({ ...group, tone: tones({ id: group.id, tone: group.tone, index }) }));
  const requested = renderer === 'auto' ? (count > embeddingLimits.canvasPoints ? 'webgl' : 'canvas') : renderer;
  const look = density(count);

  function xText(value: number): string {
    return formatValue({ value, locale, format: x.format });
  }

  function yText(value: number): string {
    return formatValue({ value, locale, format: y.format });
  }

  function place(valueX: number, valueY: number): string {
    return `${x.label} ${xText(valueX)}, ${y.label} ${yText(valueY)}`;
  }

  function rangeText(rect: DataRect, itemCount: number): string {
    const items = formatValue({ value: itemCount, locale, format: wholeNumber });

    return `${x.label} ${xText(rect.x[0])} – ${xText(rect.x[1])}, ${y.label} ${yText(rect.y[0])} – ${yText(rect.y[1])}: ${items} items`;
  }

  const groupRows = drawn.map((group, index) => {
    const items = summary.counts[index] ?? 0;
    const counted = formatValue({ value: items, locale, format: wholeNumber });
    const part = formatValue({ value: count === 0 ? 0 : items / count, locale, format: share });

    return { ...group, index, items, text: `${group.label}: ${counted} items, ${part} of the map` };
  });

  const items = [
    ...groupRows.map((group) => ({ id: group.id, label: group.text })),
    ...landmarks.map((landmark) => ({ id: landmark.id, label: `${landmark.label}: ${place(landmark.x, landmark.y)}` })),
  ];

  const legend = drawn.map((group) => ({ id: group.id, label: group.label, tone: group.tone }));
  const landmarkIds = new Set(landmarks.map((landmark) => landmark.id));
  const xSlope = Math.abs((box.right - box.left) / (shown.x[1] - shown.x[0]));
  const ySlope = Math.abs((box.bottom - box.top) / (shown.y[1] - shown.y[0]));

  function pointAt(event: PointerEvent<HTMLDivElement>): { readonly x: number; readonly y: number } {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: plot.x.valueAt(box.left + Math.max(0, Math.min(box.innerWidth, event.clientX - rect.left))),
      y: plot.y.valueAt(box.top + Math.max(0, Math.min(box.innerHeight, event.clientY - rect.top))),
    };
  }

  function hover(event: PointerEvent<HTMLDivElement>): void {
    const at = pointAt(event);
    const query = { x: at.x, y: at.y, radiusX: HOVER_RADIUS / xSlope, radiusY: HOVER_RADIUS / ySlope };

    setHovered(summary.index?.nearest(query) ?? null);
  }

  function brush(event: PointerEvent<HTMLDivElement>): void {
    const isBrushMode = !isExplorable || event.shiftKey;
    const isBrushPress = event.button === 0 && event.pointerType !== 'touch' && isBrushMode;

    if (event.pointerType === 'touch' && !isExplorable) {
      hover(event);
    }

    if (onRangeChange === undefined || releaseDrag.current !== null || !isBrushPress) {
      return;
    }

    const surface = event.currentTarget;
    const start = pointAt(event);

    function rectTo(end: { readonly x: number; readonly y: number }): DataRect {
      return {
        x: [Math.min(start.x, end.x), Math.max(start.x, end.x)],
        y: [Math.min(start.y, end.y), Math.max(start.y, end.y)],
      };
    }

    function toData(clientX: number, clientY: number): { readonly x: number; readonly y: number } {
      const rect = surface.getBoundingClientRect();

      return {
        x: plot.x.valueAt(box.left + Math.max(0, Math.min(box.innerWidth, clientX - rect.left))),
        y: plot.y.valueAt(box.top + Math.max(0, Math.min(box.innerHeight, clientY - rect.top))),
      };
    }

    setDraft(rectTo(start));

    releaseDrag.current = bindDrag(surface, event.nativeEvent, {
      cancelOnEscape: true,
      onMove: (moved) => setDraft(rectTo(toData(moved.x, moved.y))),
      onEnd: (up, canceled) => {
        releaseDrag.current = null;

        setDraft(null);

        const next = rectTo(toData(up.clientX, up.clientY));

        if (canceled || next.x[0] === next.x[1] || next.y[0] === next.y[1]) {
          return;
        }

        dispatch({ options: () => ({ onRangeChange }) }, 'onRangeChange', next, {
          reason: 'drag',
          event: up,
          count: countInside(points, next),
        });
      },
    });
  }

  function requestRange(next: DataRect | null, reason: 'clear-press' | 'trigger-press', event: Event): void {
    dispatch({ options: () => ({ onRangeChange }) }, 'onRangeChange', next, {
      reason,
      event,
      count: next === null ? 0 : countInside(points, next),
    });
  }

  function hoverText(index: number): string {
    const group = drawn[points.group[index] ?? 0];
    const name = points.ids?.[index] ?? `Item ${formatValue({ value: index + 1, locale, format: wholeNumber })}`;

    return `${name} · ${group?.label ?? ''} · ${place(points.x[index] ?? 0, points.y[index] ?? 0)}`;
  }

  function cursorRect(id: string | null, placed: ReadonlyArray<PlacedLandmark>): DataRect | undefined {
    const landmark = placed.find((candidate) => candidate.id === id);

    if (landmark !== undefined) {
      return undefined;
    }

    return summary.extents[groups.findIndex((group) => group.id === id)];
  }

  const shownRange = draft ?? range;

  return (
    <Chart
      {...link}
      items={items}
      arrows="both"
      selected={selected}
      onSelect={(id, details) => {
        if (landmarkIds.has(id)) {
          onSelectedChange?.(id, details);
        }
      }}
      render={(figureProps, { inspected, cursor }) => {
        const highlight = groups.findIndex((group) => group.id === inspected);
        const placed = placeLandmarks({ landmarks, plot, first: [selected ?? null, inspected, cursor] });
        const cursorLandmark = placed.find((landmark) => landmark.id === cursor);
        const cursorGroup = cursorRect(cursor, placed);
        const readout = hovered === null ? inspectedLabel(items, inspected) : hoverText(hovered);
        const hoveredGroup = hovered === null ? undefined : drawn[points.group[hovered] ?? 0];

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            series={legend}
            seriesLegend={<ChartLegend items={legend} label={`${title} groups`} />}
            footer={
              count === 0 ? undefined : (
                <>
                  <ChartReadout id={readoutId}>{readout}</ChartReadout>
                  {drawnWith !== null && drawnWith !== requested && (
                    <p>
                      WebGL is unavailable in this browser, so the map draws with canvas 2D and responds more slowly.
                    </p>
                  )}
                </>
              )
            }
          >
            {count === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotViewportRoot
                  view={view}
                  onViewChange={setView}
                  isEnabled={isExplorable}
                  onKeyDown={() => setHovered(null)}
                >
                  <PlotSurface
                    plotRef={size.ref}
                    box={box}
                    label={plotLabel({
                      title,
                      marks: 'groups and landmarks',
                      isSelectable: onSelectedChange !== undefined && landmarks.length > 0,
                    })}
                    readoutId={readoutId}
                    overlay={
                      <>
                        <PointLayer
                          box={box}
                          points={points}
                          x={plot.x}
                          y={plot.y}
                          tones={drawn.map((group) => group.tone)}
                          highlight={highlight === -1 ? null : highlight}
                          radius={look.radius}
                          opacity={look.opacity}
                          renderer={requested}
                          onDraw={(draw) => setDrawnWith(draw.renderer)}
                        />
                        <PlotViewportSurface
                          onPointerMove={(event) => event.pointerType === 'mouse' && hover(event)}
                          onPointerLeave={() => setHovered(null)}
                          onPointerDown={brush}
                          {...stylex.props(
                            styles.surface(box.left, box.top),
                            styles.size(box.innerWidth, box.innerHeight),
                            isExplorable ? styles.explore : onRangeChange === undefined ? styles.inspect : styles.brush,
                          )}
                        />
                        <svg
                          aria-hidden
                          width={box.width}
                          height={box.height}
                          viewBox={`0 0 ${box.width} ${box.height}`}
                          {...stylex.props(styles.layer)}
                        >
                          <PlotClip box={box}>
                            {shownRange !== null && (
                              <rect
                                x={plot.x.position(shownRange.x[0])}
                                y={plot.y.position(shownRange.y[1])}
                                width={plot.x.position(shownRange.x[1]) - plot.x.position(shownRange.x[0])}
                                height={plot.y.position(shownRange.y[0]) - plot.y.position(shownRange.y[1])}
                                {...stylex.props(styles.range)}
                              />
                            )}
                            {cursorGroup !== undefined && (
                              <rect
                                x={plot.x.position(cursorGroup.x[0]) - CURSOR_PAD}
                                y={plot.y.position(cursorGroup.y[1]) - CURSOR_PAD}
                                width={
                                  plot.x.position(cursorGroup.x[1]) - plot.x.position(cursorGroup.x[0]) + 2 * CURSOR_PAD
                                }
                                height={
                                  plot.y.position(cursorGroup.y[0]) - plot.y.position(cursorGroup.y[1]) + 2 * CURSOR_PAD
                                }
                                {...stylex.props(styles.cursorBox, chartStyles.shapeCursor)}
                              />
                            )}
                            {hovered !== null && hoveredGroup !== undefined && (
                              <DotMark
                                x={plot.x.position(points.x[hovered] ?? 0)}
                                y={plot.y.position(points.y[hovered] ?? 0)}
                                tone={hoveredGroup.tone}
                                isInspected
                              />
                            )}
                          </PlotClip>
                          {placed.map((landmark) => (
                            <ChartMark
                              key={landmark.id}
                              value={landmark.id}
                              render={<g />}
                              {...stylex.props(styles.landmark)}
                            >
                              <DotMark
                                x={landmark.left}
                                y={landmark.top}
                                tone="neutral"
                                radius={LANDMARK_RADIUS}
                                isInspected={landmark.id === inspected}
                                isSelected={landmark.id === selected}
                              />
                              {landmark.hasLabel && (
                                <LabelMark x={landmark.left + LABEL_GAP} y={landmark.top + LABEL_BASELINE}>
                                  {landmark.label}
                                </LabelMark>
                              )}
                            </ChartMark>
                          ))}
                          {cursorLandmark !== undefined && (
                            <rect
                              x={cursorLandmark.left - LANDMARK_RADIUS - CURSOR_PAD}
                              y={cursorLandmark.top - LABEL_HEIGHT / 2 - CURSOR_PAD / 2}
                              width={
                                (cursorLandmark.hasLabel ? cursorLandmark.width + LABEL_GAP : 0) +
                                2 * (LANDMARK_RADIUS + CURSOR_PAD)
                              }
                              height={LABEL_HEIGHT + CURSOR_PAD}
                              {...stylex.props(styles.cursorBox, chartStyles.shapeCursor)}
                            />
                          )}
                        </svg>
                      </>
                    }
                  >
                    <PlotAxes
                      box={box}
                      xTicks={plot.xTicks}
                      yTicks={plot.yTicks}
                      xTitle={axisTitle(x)}
                      yTitle={axisTitle(y)}
                      grid="both"
                    />
                  </PlotSurface>
                  {isExplorable && (
                    <div {...stylex.props(styles.controls)}>
                      <span>
                        Drag to pan. Pinch, or hold Control or Command and scroll, to zoom.
                        {onRangeChange === undefined ? '' : ' Hold Shift and drag to select an area.'}
                      </span>
                      <TextButton density="compact" disabled={isWholeView} onClick={() => setView(WHOLE_VIEW)}>
                        Reset view
                      </TextButton>
                    </div>
                  )}
                </PlotViewportRoot>
                {onRangeChange !== undefined && (
                  <div {...stylex.props(styles.controls)}>
                    <span>
                      {range === null
                        ? isExplorable
                          ? 'No area selected.'
                          : 'Drag on the map to select an area.'
                        : `Selected area: ${rangeText(range, rangeCount)}`}
                    </span>
                    {isExplorable && (
                      <TextButton
                        density="compact"
                        onClick={(event) =>
                          requestRange({ x: shown.x, y: shown.y }, 'trigger-press', event.nativeEvent)
                        }
                      >
                        Select visible area
                      </TextButton>
                    )}
                    <TextButton
                      density="compact"
                      disabled={range === null}
                      onClick={(event) => requestRange(null, 'clear-press', event.nativeEvent)}
                    >
                      Clear range
                    </TextButton>
                  </div>
                )}
                <ChartData
                  label={`${title} groups`}
                  columns={[
                    { id: 'group', label: 'Group' },
                    { id: 'items', label: 'Items' },
                    { id: 'share', label: 'Share' },
                  ]}
                  rows={groupRows.map((group) => ({
                    id: group.id,
                    values: [
                      group.label,
                      formatValue({ value: group.items, locale, format: wholeNumber }),
                      formatValue({ value: count === 0 ? 0 : group.items / count, locale, format: share }),
                    ],
                  }))}
                />
                {landmarks.length > 0 && (
                  <ChartData
                    label={`${title} landmarks`}
                    columns={[
                      { id: 'landmark', label: 'Landmark' },
                      { id: 'x', label: x.label },
                      { id: 'y', label: y.label },
                    ]}
                    rows={landmarks.map((landmark) => ({
                      id: landmark.id,
                      values: [landmark.label, xText(landmark.x), yText(landmark.y)],
                    }))}
                  />
                )}
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
