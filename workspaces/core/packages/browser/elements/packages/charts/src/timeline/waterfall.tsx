import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';
import { Text } from '../../../core/src/index.ts';
import { colors, conditions, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';

type WaterfallGeometry =
  | { readonly kind: 'interval'; readonly start: number; readonly end: number }
  | { readonly kind: 'point'; readonly at: number; readonly marker: 'filled' | 'hollow' | 'diamond' }
  | { readonly kind: 'unavailable' };

export type WaterfallItem = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly summary: string;
  readonly tone: 'neutral' | 'positive' | 'negative';
  readonly geometry: WaterfallGeometry;
};

type WaterfallProps = {
  readonly items: ReadonlyArray<WaterfallItem>;
  readonly start: number;
  readonly end: number;
  readonly label: string;
  readonly rowLabel: string;
  readonly summaryLabel: string;
  readonly emptyLabel: string;
  readonly selectedId: string | undefined;
  readonly onSelect: (id: string) => void;
  readonly formatOffset: (offset: number) => string;
};

const NARROW_LAYOUT = '@container (max-width:650px)';

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
    minHeight: controls.mdHeight,
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
  active: { backgroundColor: colors.canvas, boxShadow: 'inset 2px 0 currentColor' },
  name: { minWidth: 0, display: 'grid', gap: spacing.xxs },
  detail: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  selectedDetail: { whiteSpace: 'normal', overflowWrap: 'anywhere' },
  plot: {
    minWidth: 0,
    marginInline: 5,
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
  WaterfallItem['tone'],
  stylex.StyleXStyles
>;

const TICKS = [0, 0.5, 1] as const;
const PERCENT = 100;

export function Waterfall({
  items,
  start,
  end,
  label,
  rowLabel,
  summaryLabel,
  emptyLabel,
  selectedId,
  onSelect,
  formatOffset,
}: WaterfallProps): ReactNode {
  const problem = waterfallProblem({ items, start, end });

  if (problem !== undefined) {
    return <ChartInputError title={label} message={problem} />;
  }

  const span = end - start;
  const scale = scaleLinear({ domain: [start, end], range: [0, span === 0 ? 0 : PERCENT] });
  const ticks = span > 0 ? TICKS : [0];

  return (
    <div role="group" aria-label={label} {...stylex.props(styles.frame)}>
      <div {...stylex.props(styles.grid, styles.head)}>
        <Text variant="caption" tone="muted">
          {rowLabel}
        </Text>
        <div {...stylex.props(styles.plot, styles.axis)}>
          {ticks.map((tick) => (
            <span key={tick}>{formatOffset(span * tick)}</span>
          ))}
        </div>
        <span {...stylex.props(styles.summary)}>
          <Text variant="caption" tone="muted">
            {summaryLabel}
          </Text>
        </span>
      </div>
      {items.length === 0 && (
        <p {...stylex.props(styles.empty)}>
          <Text tone="muted">{emptyLabel}</Text>
        </p>
      )}
      {items.map((item) => {
        const timing = formatGeometry({ geometry: item.geometry, start, formatOffset });

        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedId === item.id}
            aria-label={`${item.label} · ${item.detail} · ${item.summary} · ${timing}`}
            onClick={() => onSelect(item.id)}
            {...stylex.props(styles.grid, styles.row, selectedId === item.id && styles.active)}
          >
            <span {...stylex.props(styles.name)}>
              <Text>{item.label}</Text>
              <span
                title={item.detail}
                {...stylex.props(styles.detail, selectedId === item.id && styles.selectedDetail)}
              >
                <Text variant="caption" tone="muted">
                  {item.detail}
                </Text>
              </span>
            </span>
            <span title={timing} {...stylex.props(styles.plot, toneStyles[item.tone])}>
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
            </span>
            <span {...stylex.props(styles.summary)}>
              <Text variant="caption" tone="muted">
                {item.summary}
              </Text>
              {selectedId === item.id && (
                <Text variant="caption" tone="muted">
                  {timing}
                </Text>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
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
  readonly scale: (value: number) => number;
}): ReactNode {
  switch (geometry.kind) {
    case 'unavailable':
      return null;
    case 'interval': {
      const x = scale(geometry.start);
      const width = scale(geometry.end) - x;

      return width === 0 ? (
        <circle cx={`${x}%`} cy={9} r={3} {...stylex.props(styles.filled)} />
      ) : (
        <Bar x={`${x}%`} y={6} width={`${width}%`} height={6} rx={2} {...stylex.props(styles.filled)} />
      );
    }
    case 'point': {
      const x = scale(geometry.at);

      switch (geometry.marker) {
        case 'filled':
          return <circle cx={`${x}%`} cy={9} r={3} {...stylex.props(styles.filled)} />;
        case 'hollow':
          return <circle cx={`${x}%`} cy={9} r={3.5} {...stylex.props(styles.hollow)} />;
        case 'diamond':
          return (
            <svg x={`${x}%`} y={9} width={1} height={1} overflow="visible">
              <path d="M0 -5 5 0 0 5 -5 0Z" {...stylex.props(styles.filled)} />
            </svg>
          );
      }
    }
  }
}

function formatGeometry({
  geometry,
  start,
  formatOffset,
}: Pick<WaterfallProps, 'start' | 'formatOffset'> & { readonly geometry: WaterfallGeometry }): string {
  switch (geometry.kind) {
    case 'interval':
      return `Start ${formatOffset(geometry.start - start)}, end ${formatOffset(geometry.end - start)}, duration ${formatOffset(geometry.end - geometry.start)}`;
    case 'point':
      return `At ${formatOffset(geometry.at - start)}`;
    case 'unavailable':
      return 'Timing unavailable';
  }
}
