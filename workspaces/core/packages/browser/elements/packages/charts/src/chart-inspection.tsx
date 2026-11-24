import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { SkeletonText } from '../../feedback/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, radii, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import type { ChartLegendItem } from './chart-frame.tsx';
import { ChartSeriesMarker } from './chart-series-marker.tsx';

export type ChartInspectionRow = ChartLegendItem & { readonly value: string };

export type ChartInspectionMode = 'inline' | 'floating';

type ChartInspectionProps = {
  readonly id: string;
  readonly label: string | undefined;
  readonly summary?: string | undefined;
  readonly legend: ReadonlyArray<ChartLegendItem>;
  readonly layoutLegend?: ReadonlyArray<ChartLegendItem> | undefined;
  readonly rows: ReadonlyArray<ChartInspectionRow>;
  readonly x: number;
  readonly width: number;
  readonly offset?: number | undefined;
  readonly notes?: ReadonlyArray<string> | undefined;
  readonly hasSeriesSummary?: boolean | undefined;
  /** False for a plot whose axis labels name every mark, so the inspector replaces the legend at every width. */
  readonly hasLegend?: boolean | undefined;
  /** Inline readout inside the legend row (default) avoids floating cards that obscure or clip over the plot. */
  readonly mode?: ChartInspectionMode | undefined;
};

const styles = stylex.create({
  frame: { minWidth: 0 },
  titleFrame: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  legends: { display: 'grid', minWidth: 0 },
  legendLayer: { gridArea: '1 / 1' },
  reserved: { visibility: 'hidden', pointerEvents: 'none' },
  title: { display: { default: 'inline', [conditions.compactText]: 'none' } },
  inspectedTitle: { display: { default: 'none', [conditions.compactText]: 'inline' } },
  legend: {
    display: { default: 'flex', [conditions.compactText]: 'grid' },
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  inlineLabel: {
    color: colors.ink,
    fontWeight: typography.mediumWeight,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  inlineValue: {
    marginInlineStart: spacing.xs,
    color: colors.ink,
    fontWeight: typography.mediumWeight,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  inlineReadoutBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    minHeight: typography.captionLineHeight,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  item: { display: 'flex', alignItems: 'baseline', gap: spacing.xs, minWidth: 0, overflowWrap: 'anywhere' },
  itemText: { minWidth: 0 },
  loadingItem: { width: { default: '18%', [conditions.compactText]: 'auto' } },
  loadingText: { flex: '1 1 0', minWidth: 0 },
  secondLoadingLine: { display: { default: 'none', [conditions.compactText]: 'block' } },
  swatch: (tone: string) => ({ width: 8, height: 8, flexShrink: 0, backgroundColor: tone }),
  mobileValue: {
    display: { default: 'none', [conditions.compactText]: 'block' },
    minHeight: typography.captionLineHeight,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
  },
  anchor: { position: 'relative', height: 0, zIndex: 1 },
  inspector: {
    display: { default: 'grid', [conditions.compactText]: 'none' },
    gap: spacing.xs,
    position: 'absolute',
    top: spacing.md,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    padding: spacing.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    boxShadow: shadows.popup,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  summaryInspector: { display: { default: 'grid', [conditions.compactText]: 'grid' } },
  position: (left: number, width: number) => ({ left, width }),
  heading: { display: 'flex', justifyContent: 'space-between', gap: spacing.sm, fontWeight: typography.mediumWeight },
  values: { display: 'grid', gap: spacing.xs, margin: 0 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  value: { margin: 0, whiteSpace: 'nowrap' },
  accessible: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
});

const UNKNOWN_LEGEND_SLOTS = 4;

export function ChartLegendLoading(): ReactNode {
  return (
    <ul aria-hidden inert {...stylex.props(styles.legend)}>
      {Array.from({ length: UNKNOWN_LEGEND_SLOTS }, (_, index) => (
        <li key={index} {...stylex.props(styles.item, styles.loadingItem)}>
          <span {...stylex.props(styles.swatch(colors.line))} />
          <span {...stylex.props(styles.loadingText)}>
            <SkeletonText />
            <span {...stylex.props(styles.secondLoadingLine)}>
              <SkeletonText />
            </span>
            <span {...stylex.props(styles.mobileValue)}>
              <SkeletonText />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ChartInspectionTitle({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail: string | undefined;
}): ReactNode {
  if (detail === undefined) {
    return title;
  }

  return (
    <span aria-label={title} {...stylex.props(styles.titleFrame)}>
      <span {...stylex.props(styles.title)}>{title}</span>
      <span {...stylex.props(styles.inspectedTitle)}>{detail}</span>
    </span>
  );
}

export function inspectionReadout({
  label,
  summary,
  rows,
  notes = [],
}: Pick<ChartInspectionProps, 'label' | 'summary' | 'rows' | 'notes'>): string | undefined {
  if (label === undefined) {
    return undefined;
  }

  return [label, summary, ...rows.map((row) => `${row.label}: ${row.value}`), ...notes]
    .filter((value) => value !== undefined)
    .join(' · ');
}

export function ChartInspection({
  id,
  label,
  summary,
  legend,
  layoutLegend,
  rows,
  x,
  width,
  offset = 16,
  notes = [],
  hasSeriesSummary = false,
  hasLegend = true,
  mode = 'inline',
}: ChartInspectionProps): ReactNode {
  const showsLegend = hasLegend && !hasSeriesSummary;
  const isInline = mode === 'inline';
  const hasLabel = label !== undefined;
  const showsInlineHeader = isInline && hasLabel;
  const showsInlineBar = !showsLegend && isInline;
  const showsFloatingCard = !isInline && hasLabel;
  const inspectorWidth = Math.min(260, Math.max(0, width));
  const preferredLeft = x > width / 2 ? x - inspectorWidth - offset : x + offset;
  const left = Math.max(0, Math.min(Math.max(0, width - inspectorWidth), preferredLeft));

  const legendBlock = showsLegend ? (
    <div {...stylex.props(styles.legends)}>
      {layoutLegend === undefined ? null : (
        <ul aria-hidden inert {...stylex.props(styles.legend, styles.legendLayer, styles.reserved)}>
          {layoutLegend.map((item) => (
            <li key={item.id} {...stylex.props(styles.item)}>
              <ChartSeriesMarker tone={item.tone} shape={item.shape} />
              <span {...stylex.props(styles.itemText)}>
                {item.label}
                <span {...stylex.props(styles.mobileValue)} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul aria-label="Legend" {...stylex.props(styles.legend, styles.legendLayer)}>
        {showsInlineHeader ? (
          <li {...stylex.props(styles.inlineLabel)}>
            {label}
            {summary === undefined ? '' : ` · ${summary}`}
          </li>
        ) : null}
        {legend.map((item) => {
          const value = label === undefined ? undefined : (rows.find((row) => row.id === item.id)?.value ?? '—');

          const valueNode = isInline ? (
            value === undefined ? null : (
              <span {...stylex.props(styles.inlineValue)}>{value}</span>
            )
          ) : (
            <span {...stylex.props(styles.mobileValue)}>{value ?? ''}</span>
          );

          return (
            <li key={item.id} {...stylex.props(styles.item)}>
              <ChartSeriesMarker tone={item.tone} shape={item.shape} />
              <span {...stylex.props(styles.itemText)}>
                {item.label}
                {valueNode}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  ) : null;

  return (
    <div {...stylex.props(styles.frame)}>
      {legendBlock}
      {showsInlineBar && (
        <div aria-hidden {...stylex.props(styles.inlineReadoutBar)}>
          {hasLabel && (
            <>
              <span {...stylex.props(styles.inlineLabel)}>
                {label}
                {summary === undefined ? '' : ` · ${summary}`}
              </span>
              {rows.map((row) => (
                <span key={row.id} {...stylex.props(styles.item)}>
                  <ChartSeriesMarker tone={row.tone} shape={row.shape} />
                  {row.label}
                  <span {...stylex.props(styles.inlineValue)}>{row.value}</span>
                </span>
              ))}
              {notes.map((note) => (
                <span key={note}>{note}</span>
              ))}
            </>
          )}
        </div>
      )}
      <span id={id} {...stylex.props(styles.accessible)}>
        {inspectionReadout({ label, summary, rows, notes })}
      </span>
      {showsFloatingCard && (
        <div aria-hidden {...stylex.props(styles.anchor)}>
          <div
            {...stylex.props(
              styles.inspector,
              !showsLegend && styles.summaryInspector,
              styles.position(left, inspectorWidth),
            )}
          >
            <div {...stylex.props(styles.heading)}>
              <span>{label}</span>
              {summary !== undefined && <span>{summary}</span>}
            </div>
            <dl {...stylex.props(styles.values)}>
              {rows.map((row) => (
                <div key={row.id} {...stylex.props(styles.row)}>
                  <dt {...stylex.props(styles.item)}>
                    <ChartSeriesMarker tone={row.tone} shape={row.shape} />
                    {row.label}
                  </dt>
                  <dd {...stylex.props(styles.value)}>{row.value}</dd>
                </div>
              ))}
            </dl>
            {notes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
