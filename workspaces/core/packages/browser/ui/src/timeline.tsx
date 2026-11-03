import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

export type TimelineItem = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly start: number;
  readonly end: number | null;
  readonly state: 'complete' | 'pending' | 'refused';
  readonly summary: string;
};

const styles = stylex.create({
  heading: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px',
    fontSize: 12,
    color: colors.muted,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  row: {
    'display': 'grid',
    'gridTemplateColumns': 'minmax(130px, 1fr) minmax(60px, 1fr)',
    'gap': 12,
    'alignItems': 'center',
    'width': '100%',
    'padding': '14px 16px',
    'borderWidth': 0,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'backgroundColor': colors.surface,
    'textAlign': 'left',
    'cursor': 'pointer',
    'color': colors.ink,
    'fontFamily': 'inherit',
    ':hover': { backgroundColor: colors.canvas },
  },
  selected: { backgroundColor: colors.canvas, boxShadow: 'inset 2px 0 #171717' },
  name: { fontSize: 12, fontWeight: 500, marginBottom: 4 },
  secondary: { fontSize: 11, lineHeight: 1.5, color: colors.muted, overflowWrap: 'anywhere' },
  chart: { width: '100%', height: 22, display: 'block' },
  complete: { fill: colors.accent },
  pending: { fill: colors.muted },
  refused: { fill: colors.danger },
  guide: { stroke: colors.line, strokeWidth: 1 },
  summary: { textAlign: 'right', fontSize: 11, color: colors.muted, fontVariantNumeric: 'tabular-nums' },
});

/** Recorded intervals share one axis. A point marks a refusal or a request with no recorded end. */
export function Timeline({
  items,
  start,
  end,
  selected,
  onSelect,
  duration,
}: {
  readonly items: ReadonlyArray<TimelineItem>;
  readonly start: number;
  readonly end: number;
  readonly selected: string | undefined;
  readonly onSelect: (id: string) => void;
  readonly duration: string;
}): ReactNode {
  const scale = scaleLinear({ domain: [start, Math.max(start + 1, end)], range: [2, 298], clamp: true });

  return (
    <div>
      <div {...stylex.props(styles.heading)}>
        <span>Model requests</span>
        <span>0 → {duration}</span>
      </div>
      {items.map((item) => {
        const x = scale(item.start);
        const width = item.end === null ? 3 : Math.max(3, scale(item.end) - x);

        return (
          <button
            type="button"
            key={item.id}
            aria-pressed={selected === item.id}
            aria-label={`${item.label} · ${item.detail} · ${item.summary}`}
            onClick={() => onSelect(item.id)}
            {...stylex.props(styles.row, selected === item.id && styles.selected)}
          >
            <div>
              <div {...stylex.props(styles.name)}>{item.label}</div>
              <div {...stylex.props(styles.secondary)}>{item.detail}</div>
            </div>
            <div>
              <svg viewBox="0 0 302 22" preserveAspectRatio="none" aria-hidden {...stylex.props(styles.chart)}>
                {[2, 150, 298].map((guide) => (
                  <line key={guide} x1={guide} x2={guide} y1={0} y2={22} {...stylex.props(styles.guide)} />
                ))}
                <Bar
                  x={x}
                  y={6}
                  width={width}
                  height={10}
                  rx={2}
                  {...stylex.props(
                    item.state === 'complete' && styles.complete,
                    item.state === 'pending' && styles.pending,
                    item.state === 'refused' && styles.refused,
                  )}
                />
              </svg>
              <div {...stylex.props(styles.summary)}>{item.summary}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
