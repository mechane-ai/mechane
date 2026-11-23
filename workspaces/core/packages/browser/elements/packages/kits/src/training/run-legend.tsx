import * as stylex from '@stylexjs/stylex';
import { Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { RunMarker } from './run-marker.tsx';
import type { RunChangeDetails, RunRecord, RunState } from './runs.ts';

export type RunLegendLabels = {
  readonly legend: string;
  readonly hide: string;
  readonly show: string;
  readonly states: Readonly<Record<RunState, string>>;
};

export type RunLegendProps = {
  readonly runs: ReadonlyArray<RunRecord>;
  readonly selected: string | null;
  readonly hidden: ReadonlyArray<string>;
  readonly labels: RunLegendLabels;
  readonly onSelectedChange?: ((id: string | null, details: RunChangeDetails) => void) | undefined;
  readonly onHiddenChange?: ((ids: ReadonlyArray<string>, details: RunChangeDetails) => void) | undefined;
};

const ICON_SIZE = 14;

const styles = stylex.create({
  list: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, margin: 0, padding: 0, listStyle: 'none', minWidth: 0 },
  chip: {
    display: 'inline-flex',
    alignItems: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  chipSelected: { borderColor: colors.ink },
  chipHidden: { backgroundColor: colors.canvas },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    minHeight: controls.compactHeight,
    paddingInline: spacing.sm,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.ink,
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    outlineColor: colors.focus,
    outlineOffset: -2,
  },
  name: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dimmed: { color: colors.muted, textDecoration: 'line-through', opacity: 0.7 },
  toggle: { color: colors.muted, borderInlineStart: `1px solid ${colors.line}` },
});

/**
 * One chip per run: pressing the name focuses the run in the charts, pressing the eye hides or shows its curves. The
 * application holds both choices.
 */
export function RunLegend({
  runs,
  selected,
  hidden,
  labels,
  onSelectedChange,
  onHiddenChange,
}: RunLegendProps): ReactNode {
  return (
    <ul aria-label={labels.legend} {...stylex.props(styles.list)}>
      {runs.map((run) => {
        const isHidden = hidden.includes(run.id);
        const isSelected = selected === run.id;
        const Icon = isHidden ? EyeOff : Eye;

        return (
          <li
            key={run.id}
            {...stylex.props(styles.chip, isSelected && styles.chipSelected, isHidden && styles.chipHidden)}
          >
            <button
              type="button"
              aria-pressed={isSelected}
              title={`${run.label} · ${labels.states[run.state]}`}
              onClick={(event) =>
                onSelectedChange?.(isSelected ? null : run.id, { reason: 'press', event: event.nativeEvent })
              }
              {...stylex.props(styles.button)}
            >
              <RunMarker id={run.id} />
              <span {...stylex.props(styles.name, isHidden && styles.dimmed)}>{run.label}</span>
            </button>
            <button
              type="button"
              aria-pressed={!isHidden}
              aria-label={`${isHidden ? labels.show : labels.hide} ${run.label}`}
              onClick={(event) =>
                onHiddenChange?.(isHidden ? hidden.filter((id) => id !== run.id) : [...hidden, run.id], {
                  reason: 'press',
                  event: event.nativeEvent,
                })
              }
              {...stylex.props(styles.button, styles.toggle)}
            >
              <Icon size={ICON_SIZE} aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
