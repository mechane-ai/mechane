import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, radii, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import type { ChartLegendItem } from './chart-frame.tsx';
import { chartToneColors } from './chart-theme.ts';

export type ChartInspectionRow = ChartLegendItem & { readonly value: string };

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
  readonly source: 'pointer' | 'keyboard' | undefined;
  readonly notes?: ReadonlyArray<string> | undefined;
  readonly hasSeriesSummary?: boolean | undefined;
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
    columnGap: spacing.md,
    rowGap: spacing.xs,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  item: { display: 'flex', alignItems: 'baseline', gap: spacing.xs, minWidth: 0, overflowWrap: 'anywhere' },
  itemText: { minWidth: 0 },
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
  source,
  notes = [],
  hasSeriesSummary = false,
}: ChartInspectionProps): ReactNode {
  const inspectorWidth = Math.min(260, width);
  const preferredLeft = x > width / 2 ? x - inspectorWidth - offset : x + offset;
  const left = Math.max(0, Math.min(width - inspectorWidth, preferredLeft));

  const text =
    label === undefined
      ? []
      : [label, summary, ...rows.map((row) => `${row.label}: ${row.value}`), ...notes].filter(
          (value) => value !== undefined,
        );

  return (
    <div {...stylex.props(styles.frame)}>
      {!hasSeriesSummary && (
        <div {...stylex.props(styles.legends)}>
          {layoutLegend !== undefined && (
            <ul aria-hidden inert {...stylex.props(styles.legend, styles.legendLayer, styles.reserved)}>
              {layoutLegend.map((item) => (
                <li key={item.id} {...stylex.props(styles.item)}>
                  <span {...stylex.props(styles.swatch(chartToneColors[item.tone]))} />
                  <span {...stylex.props(styles.itemText)}>
                    {item.label}
                    <span {...stylex.props(styles.mobileValue)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ul aria-label="Legend" {...stylex.props(styles.legend, styles.legendLayer)}>
            {legend.map((item) => (
              <li key={item.id} {...stylex.props(styles.item)}>
                <span aria-hidden {...stylex.props(styles.swatch(chartToneColors[item.tone]))} />
                <span {...stylex.props(styles.itemText)}>
                  {item.label}
                  <span {...stylex.props(styles.mobileValue)}>
                    {label === undefined ? '' : (rows.find((row) => row.id === item.id)?.value ?? '—')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <span id={id} aria-live={source === 'keyboard' ? 'polite' : 'off'} {...stylex.props(styles.accessible)}>
        {text.join(' · ')}
      </span>
      {label !== undefined && (
        <div aria-hidden {...stylex.props(styles.anchor)}>
          <div
            {...stylex.props(
              styles.inspector,
              hasSeriesSummary && styles.summaryInspector,
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
                    <span {...stylex.props(styles.swatch(chartToneColors[row.tone]))} />
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
