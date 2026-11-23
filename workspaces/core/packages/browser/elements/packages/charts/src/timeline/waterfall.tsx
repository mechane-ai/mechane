import * as stylex from '@stylexjs/stylex';
import {
  Waterfall as Spans,
  WaterfallBar,
  WaterfallCell,
  WaterfallColumnHeader,
  WaterfallHeaderRow,
  WaterfallRow,
  WaterfallRowHeader,
} from '@ui-sdk/react/waterfall';
import type { WaterfallProps as SpansProps } from '@ui-sdk/react/waterfall';
import type { ReactNode, Ref } from 'react';
import { Text } from '../../../core/src/index.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, shadows, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { hasUniqueIds } from '../chart-input.ts';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureFrame, FigureInvalid } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { continuousScale } from '../plot/scale.ts';
import type { ContinuousScale } from '../plot/scale.ts';

/** A row's timing: two recorded endpoints, one recorded instant, or none. Nothing is drawn from a missing endpoint. */
export type WaterfallGeometry =
  | { readonly kind: 'interval'; readonly start: number; readonly end: number }
  | { readonly kind: 'point'; readonly at: number; readonly marker: 'filled' | 'hollow' | 'diamond' }
  | { readonly kind: 'unavailable' };

/** The tones a waterfall row takes: neutral evidence, a success, or a failure. */
export type WaterfallTone = Extract<ChartTone, 'neutral' | 'positive' | 'negative'>;

/** One timed row. Rows keep the supplied order and share one scale. */
export type WaterfallItem = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly summary: string;
  /** Neutral when left out. */
  readonly tone?: WaterfallTone | undefined;
  readonly geometry: WaterfallGeometry;
  /** The id of the region this row updates when selected, exposed as `aria-controls`. */
  readonly controls?: string | undefined;
};

/** Why the selection wants to change: a press or Enter on a row, or a call such as an agent's step. */
export type WaterfallSelectDetails = Parameters<NonNullable<SpansProps['onValueChange']>>[1];

export type WaterfallProps = Pick<
  FigureProps,
  'title' | 'description' | 'report' | 'actions' | 'locale' | 'source' | 'transforms' | 'emptyLabel'
> & {
  readonly items: ReadonlyArray<WaterfallItem>;
  /** The time domain every row shares, in the unit of `offsetFormat`. */
  readonly start: number;
  readonly end: number;
  readonly rowLabel: string;
  readonly summaryLabel: string;
  readonly selected?: string | null | undefined;
  /** The selected row, which takes focus, so an owner can return focus to it. */
  readonly selectedRef?: Ref<HTMLDivElement> | undefined;
  readonly onSelectedChange: (id: string, details: WaterfallSelectDetails) => void;
  /** How a time from the start of the domain is written, with its unit. */
  readonly offsetFormat: ValueFormat;
};

const NARROW_LAYOUT = '@container (max-width:650px)';
const POINT_RADIUS_PX = 5;

const styles = stylex.create({
  frame: { minWidth: 0, fontFamily: typography.fontFamily, containerType: 'inline-size' },
  grid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(110px, 1fr) minmax(120px, 2fr) minmax(110px, 1fr)',
      [NARROW_LAYOUT]: 'minmax(0, 1fr) minmax(0, 1fr)',
    },
    alignItems: 'center',
    rowGap: spacing.xs,
    columnGap: spacing.lg,
    width: '100%',
    boxSizing: 'border-box',
    paddingInline: spacing.md,
  },
  head: {
    minHeight: controls.height,
    color: colors.muted,
    fontSize: typography.captionSize,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  row: {
    'paddingBlock': spacing.sm,
    'minHeight': 52,
    'borderWidth': 0,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'textAlign': 'start',
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: -2,
    },
    ':last-child': { borderBottomWidth: 0 },
  },
  active: { backgroundColor: colors.canvas, boxShadow: shadows.selection },
  cell: {
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: 2,
    },
  },
  name: { minWidth: 0, display: 'grid', gap: spacing.xxs },
  detail: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  selectedDetail: { whiteSpace: 'normal', overflowWrap: 'anywhere' },
  plot: {
    minWidth: 0,
    marginInline: POINT_RADIUS_PX,
    gridColumn: { default: '2', [NARROW_LAYOUT]: '1 / -1' },
    gridRow: { default: 1, [NARROW_LAYOUT]: 2 },
  },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  svg: { display: 'block', width: '100%', height: 18, overflow: 'visible' },
  guide: { stroke: colors.line },
  neutral: { color: colors.muted },
  positive: { color: colors.accent },
  negative: { color: colors.danger },
  filled: { fill: 'currentColor' },
  hollow: { fill: colors.surface, stroke: 'currentColor', strokeWidth: 2 },
  summary: {
    display: 'grid',
    gap: spacing.xxs,
    minWidth: 0,
    gridColumn: { default: '3', [NARROW_LAYOUT]: '2' },
    gridRow: 1,
    textAlign: 'end',
    overflowWrap: 'anywhere',
    fontVariantNumeric: 'tabular-nums',
  },
  empty: { margin: 0, padding: spacing.lg },
});

const toneStyles = { neutral: styles.neutral, positive: styles.positive, negative: styles.negative } satisfies Record<
  WaterfallTone,
  stylex.StyleXStyles
>;

const TICKS = [0, 0.5, 1] as const;
const PERCENT = 100;

/**
 * Recorded intervals and instants of many rows on one time scale, such as the steps of a request or a run. Each row
 * states its exact timing as text, a row without timing says so, and the rows are one Tab stop the application selects
 * from.
 */
export function Waterfall({
  items,
  start,
  end,
  rowLabel,
  summaryLabel,
  emptyLabel = 'No timing records are available.',
  selected,
  selectedRef,
  onSelectedChange,
  offsetFormat,
  ...frame
}: WaterfallProps): ReactNode {
  const { title, locale } = frame;
  const problem = waterfallProblem({ items, start, end });

  if (problem !== undefined) {
    return <FigureInvalid {...frame} message={problem} />;
  }

  const span = end - start;
  const scale = continuousScale({ domain: [start, end], range: [0, PERCENT] });
  const ticks = span > 0 ? TICKS : [0];
  const hasTiming = items.some((item) => item.geometry.kind !== 'unavailable');

  function offset(value: number): string {
    return formatValue({ value, locale, format: offsetFormat });
  }

  const timings = new Map(items.map((item) => [item.id, formatGeometry({ geometry: item.geometry, start, offset })]));

  // The label starts with the row's name for typeahead and carries its exact values for an agent.
  const spans = items.map((item) => ({
    value: item.id,
    label: `${item.label} · ${item.detail} · ${item.summary} · ${timings.get(item.id)}`,
    ...spanTime(item.geometry),
  }));

  const rows =
    items.length === 0 ? (
      <div role="group" aria-label={title} {...stylex.props(styles.frame)}>
        <p {...stylex.props(styles.empty)}>
          <Text tone="muted">{emptyLabel}</Text>
        </p>
      </div>
    ) : (
      <Spans
        items={spans}
        range={[start, end]}
        value={selected ?? null}
        onValueChange={(id, details) => {
          if (id !== null) {
            onSelectedChange(id, details);
          }
        }}
        getBarLabel={(row) => timings.get(row.value) ?? ''}
        aria-label={title}
        {...stylex.props(styles.frame)}
      >
        <WaterfallHeaderRow {...stylex.props(styles.grid, styles.head)}>
          <WaterfallColumnHeader>
            <Text variant="caption" tone="muted">
              {rowLabel}
            </Text>
          </WaterfallColumnHeader>
          <WaterfallColumnHeader aria-label="Timing" {...stylex.props(styles.plot, styles.axis)}>
            {hasTiming ? (
              ticks.map((tick) => <span key={tick}>{offset(span * tick)}</span>)
            ) : (
              <span>Timing unavailable</span>
            )}
          </WaterfallColumnHeader>
          <WaterfallColumnHeader {...stylex.props(styles.summary)}>
            <Text variant="caption" tone="muted">
              {summaryLabel}
            </Text>
          </WaterfallColumnHeader>
        </WaterfallHeaderRow>
        {items.map((item) => {
          const timing = timings.get(item.id);
          const isSelected = selected === item.id;

          return (
            <WaterfallRow
              key={item.id}
              value={item.id}
              ref={isSelected ? selectedRef : undefined}
              aria-controls={item.controls}
              {...stylex.props(styles.grid, styles.row, isSelected && styles.active)}
            >
              <WaterfallRowHeader {...stylex.props(styles.name, styles.cell)}>
                <Text>{item.label}</Text>
                <span title={item.detail} {...stylex.props(styles.detail, isSelected && styles.selectedDetail)}>
                  <Text variant="caption" tone="muted">
                    {item.detail}
                  </Text>
                </span>
              </WaterfallRowHeader>
              <WaterfallBar
                title={timing}
                {...stylex.props(styles.plot, styles.cell, toneStyles[item.tone ?? 'neutral'])}
              >
                {item.geometry.kind === 'unavailable' ? (
                  <Text variant="caption" tone="muted">
                    {timing}
                  </Text>
                ) : (
                  <svg aria-hidden {...stylex.props(styles.svg)}>
                    {ticks.map((tick) => (
                      <line
                        key={tick}
                        x1={`${tick * PERCENT}%`}
                        x2={`${tick * PERCENT}%`}
                        y1="0"
                        y2="18"
                        {...stylex.props(styles.guide)}
                      />
                    ))}
                    <WaterfallMark geometry={item.geometry} scale={scale} />
                  </svg>
                )}
              </WaterfallBar>
              <WaterfallCell {...stylex.props(styles.summary, styles.cell)}>
                <Text variant="caption" tone="muted">
                  {item.summary}
                </Text>
                {isSelected && (
                  <Text variant="caption" tone="muted">
                    {timing}
                  </Text>
                )}
              </WaterfallCell>
            </WaterfallRow>
          );
        })}
      </Spans>
    );

  return <FigureFrame {...frame}>{rows}</FigureFrame>;
}

function waterfallProblem({ items, start, end }: Pick<WaterfallProps, 'items' | 'start' | 'end'>): string | undefined {
  const hasNonfiniteEndpoints = !Number.isFinite(start) || !Number.isFinite(end);

  if (hasNonfiniteEndpoints || !Number.isFinite(end - start) || end < start) {
    return 'The timing domain must have finite, ordered endpoints.';
  }

  if (!hasUniqueIds(items)) {
    return 'Timing records must have unique identifiers.';
  }

  for (const item of items) {
    const geometry = item.geometry;

    if (geometry.kind === 'interval') {
      if (!Number.isFinite(geometry.start) || !Number.isFinite(geometry.end) || geometry.end < geometry.start) {
        return 'Timing intervals must have finite, ordered endpoints.';
      }

      if (geometry.start < start || geometry.end > end) {
        return 'Timing intervals must fit inside the supplied domain.';
      }
    }

    if (geometry.kind === 'point') {
      const hasInvalidInstant = !Number.isFinite(geometry.at) || geometry.at < start || geometry.at > end;

      if (hasInvalidInstant) {
        return 'Timing points must be finite and fit inside the supplied domain.';
      }
    }
  }

  return undefined;
}

function WaterfallMark({
  geometry,
  scale,
}: {
  readonly geometry: WaterfallGeometry;
  readonly scale: ContinuousScale;
}): ReactNode {
  switch (geometry.kind) {
    case 'unavailable':
      return null;
    case 'interval': {
      const x = scale.position(geometry.start);
      const width = scale.position(geometry.end) - x;

      return width === 0 ? (
        <circle cx={`${x}%`} cy={9} r={3} {...stylex.props(styles.filled)} />
      ) : (
        <rect x={`${x}%`} y={6} width={`${width}%`} height={6} rx={2} {...stylex.props(styles.filled)} />
      );
    }
    case 'point': {
      const x = scale.position(geometry.at);

      switch (geometry.marker) {
        case 'filled':
          return <circle cx={`${x}%`} cy={9} r={3} {...stylex.props(styles.filled)} />;
        case 'hollow':
          return <circle cx={`${x}%`} cy={9} r={3.5} {...stylex.props(styles.hollow)} />;
        case 'diamond':
          return (
            <svg x={`${x}%`} y={9} width={1} height={1} overflow="visible">
              <path
                d={`M0 -${POINT_RADIUS_PX} ${POINT_RADIUS_PX} 0 0 ${POINT_RADIUS_PX} -${POINT_RADIUS_PX} 0Z`}
                {...stylex.props(styles.filled)}
              />
            </svg>
          );
      }
    }
  }
}

/**
 * The start and duration the SDK takes for every span. A point lasts no time. A row without timing has no number to
 * give, so it gets none: its text and its mark come from the geometry and never from a made-up endpoint.
 */
function spanTime(geometry: WaterfallGeometry): { readonly start: number; readonly duration: number } {
  switch (geometry.kind) {
    case 'interval':
      return { start: geometry.start, duration: geometry.end - geometry.start };
    case 'point':
      return { start: geometry.at, duration: 0 };
    case 'unavailable':
      return { start: Number.NaN, duration: Number.NaN };
  }
}

function formatGeometry({
  geometry,
  start,
  offset,
}: Pick<WaterfallProps, 'start'> & {
  readonly geometry: WaterfallGeometry;
  readonly offset: (value: number) => string;
}): string {
  switch (geometry.kind) {
    case 'interval':
      return `Start ${offset(geometry.start - start)}, end ${offset(geometry.end - start)}, duration ${offset(geometry.end - geometry.start)}`;
    case 'point':
      return `At ${offset(geometry.at - start)}`;
    case 'unavailable':
      return 'Timing unavailable';
  }
}
