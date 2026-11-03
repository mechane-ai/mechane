import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

export type TimelineItem = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly start: number | null;
  readonly end: number | null;
  readonly state: 'complete' | 'pending' | 'refused' | 'unknown';
  readonly summary: string;
};

const styles = stylex.create({
  frame: { minWidth: 0 },
  grid: {
    display: 'grid',
    gridTemplateColumns: {
      'default': 'minmax(110px, 1fr) minmax(120px, 2fr) minmax(110px, 1fr)',
      '@media (max-width:650px)': 'minmax(0, 1fr) auto',
    },
    alignItems: 'center',
    gap: '6px 18px',
    width: '100%',
    paddingInline: 14,
  },
  head: {
    minHeight: 36,
    color: colors.muted,
    fontSize: 12,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  row: {
    'paddingBlock': 10,
    'minHeight': 52,
    'borderWidth': 0,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': 'inherit',
    'textAlign': 'start',
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
    ':focus-visible': { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: -2 },
    ':last-child': { borderBottomWidth: 0 },
  },
  active: { backgroundColor: colors.canvas, boxShadow: 'inset 2px 0 currentColor' },
  name: { minWidth: 0, display: 'grid', gap: 2 },
  label: { fontSize: 13, fontWeight: 500, lineHeight: '18px' },
  detail: { color: colors.muted, fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  plot: {
    minWidth: 0,
    marginInline: 5,
    gridColumn: { 'default': '2', '@media (max-width:650px)': '1 / -1' },
    gridRow: { 'default': 1, '@media (max-width:650px)': 2 },
  },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    lineHeight: '20px',
    fontVariantNumeric: 'tabular-nums',
  },
  svg: { display: 'block', width: '100%', height: 18, overflow: 'visible' },
  guide: { stroke: colors.line },
  complete: { fill: colors.accent },
  pending: { fill: colors.surface, stroke: colors.muted, strokeWidth: 2 },
  refused: { fill: colors.danger },
  summary: {
    gridColumn: { 'default': '3', '@media (max-width:650px)': '2' },
    gridRow: 1,
    textAlign: 'end',
    fontSize: 12,
    lineHeight: '18px',
    fontVariantNumeric: 'tabular-nums',
    color: colors.muted,
  },
});

const TICKS = [0, 0.5, 1] as const;
const PERCENT = 100;

export function Timeline({
  items,
  start,
  end,
  selected,
  onSelect,
  formatOffset,
}: {
  readonly items: ReadonlyArray<TimelineItem>;
  readonly start: number;
  readonly end: number;
  readonly selected?: string | undefined;
  readonly onSelect: (id: string) => void;
  readonly formatOffset: (milliseconds: number) => string;
}): ReactNode {
  const span = end - start;
  const scale = scaleLinear({ domain: [start, Math.max(start + 1, end)], range: [0, PERCENT], clamp: true });
  const ticks = span > 0 ? TICKS : [0];

  return (
    <div aria-label="Request timing" {...stylex.props(styles.frame)}>
      <div {...stylex.props(styles.grid, styles.head)}>
        <span>Model request</span>
        <div {...stylex.props(styles.plot, styles.axis)}>
          {ticks.map((tick) => (
            <span key={tick}>{formatOffset(span * tick)}</span>
          ))}
        </div>
        <span {...stylex.props(styles.summary)}>Recorded outcome</span>
      </div>
      {items.map((item) => {
        const x = item.start === null ? 0 : scale(item.start);
        const width = item.end === null ? 0 : scale(item.end) - x;

        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === item.id}
            aria-label={`${item.label} · ${item.detail} · ${item.summary}`}
            onClick={() => onSelect(item.id)}
            {...stylex.props(styles.grid, styles.row, selected === item.id && styles.active)}
          >
            <span {...stylex.props(styles.name)}>
              <span {...stylex.props(styles.label)}>{item.label}</span>
              <span title={item.detail} {...stylex.props(styles.detail)}>
                {item.detail}
              </span>
            </span>
            <span {...stylex.props(styles.plot)}>
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
                {item.state === 'complete' &&
                  (width > 0 ? (
                    <Bar x={`${x}%`} y={6} width={`${width}%`} height={6} rx={2} {...stylex.props(styles.complete)} />
                  ) : (
                    <circle cx={`${x}%`} cy={9} r={3} {...stylex.props(styles.complete)} />
                  ))}
                {item.state === 'pending' && <circle cx={`${x}%`} cy={9} r={3.5} {...stylex.props(styles.pending)} />}
                {item.state === 'refused' && (
                  <svg x={`${x}%`} y={9} width={1} height={1} overflow="visible">
                    <path d="M0 -5 5 0 0 5 -5 0Z" {...stylex.props(styles.refused)} />
                  </svg>
                )}
              </svg>
            </span>
            <span {...stylex.props(styles.summary)}>{item.summary}</span>
          </button>
        );
      })}
    </div>
  );
}
