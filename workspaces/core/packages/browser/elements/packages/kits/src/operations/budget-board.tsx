import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { BulletBar } from '../../../charts/src/comparison/index.ts';
import type { BulletRange } from '../../../charts/src/comparison/index.ts';
import { formatValue, ToneScope } from '../../../charts/src/index.ts';
import type { FigureSelectionProps, FigureStatus, PlotAxis } from '../../../charts/src/index.ts';
import { Status, Text } from '../../../core/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

/** How the row's state icon reads. The state itself is always written in words. */
export type BudgetTone = 'positive' | 'warning' | 'negative' | 'neutral';

/** One objective or budget: what was measured, what it is held against, and the application's verdict in words. */
export type BudgetRow = {
  readonly id: string;
  readonly label: string;
  /** The measured amount, or null where it was not measured. */
  readonly value: number | null;
  /** The objective or budget limit. */
  readonly target: number;
  /** Qualitative bands behind the bar, in increasing `upTo`. */
  readonly ranges?: ReadonlyArray<BulletRange> | undefined;
  /** The state in words, such as "Within budget" or "Budget spent". The application decides it. */
  readonly state: string;
  readonly tone: BudgetTone;
  /** One sentence of evidence beside the state, such as "31% of the monthly budget left". */
  readonly detail?: string | undefined;
};

/** Rows that share one measured axis and unit, such as every latency objective. */
export type BudgetGroup = {
  readonly id: string;
  readonly title: string;
  readonly description?: string | undefined;
  /** The measured axis of the group. It starts at zero. */
  readonly value: PlotAxis;
  readonly rows: ReadonlyArray<BudgetRow>;
};

/** The words BudgetBoard writes itself. Each has an English default. */
export type BudgetBoardLabels = {
  readonly empty: string;
  readonly duplicateIds: string;
  readonly measured: string;
  readonly target: string;
};

export type BudgetBoardProps = FigureSelectionProps & {
  readonly groups: ReadonlyArray<BudgetGroup>;
  readonly locale: string;
  readonly status?: FigureStatus | undefined;
  readonly labels?: Partial<BudgetBoardLabels> | undefined;
};

const defaultLabels: BudgetBoardLabels = {
  empty: 'No objectives are set for this service.',
  duplicateIds: 'Budget rows need unique identifiers.',
  measured: 'Measured',
  target: 'Target',
};

const styles = stylex.create({
  board: { display: 'grid', gap: spacing.xl, minWidth: 0 },
  group: { display: 'grid', gap: spacing.md, minWidth: 0 },
  states: {
    display: 'grid',
    gap: spacing.xs,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  state: {
    display: 'grid',
    gridTemplateColumns: 'minmax(8ch, 1fr) auto',
    columnGap: spacing.lg,
    rowGap: spacing.xxs,
    alignItems: 'baseline',
    minWidth: 0,
    paddingBlock: spacing.xs,
    paddingInline: spacing.sm,
    borderRadius: radii.sm,
  },
  isSelected: { backgroundColor: colors.canvas },
  name: { minWidth: 0, overflowWrap: 'anywhere' },
  note: { gridColumn: '1 / -1', color: colors.muted, fontSize: typography.captionSize },
});

/**
 * Service level objectives and budgets as bars against their targets, with the state of each written in words beside
 * its name. Rows that share a unit go in one group and share an axis. The application supplies every value, target,
 * range and verdict: a state is never worked out from a color or a number.
 */
export function BudgetBoard({
  groups,
  locale,
  status,
  selected,
  onSelectedChange,
  labels,
}: BudgetBoardProps): ReactNode {
  const words = { ...defaultLabels, ...labels };
  const ids = groups.flatMap((group) => group.rows.map((row) => row.id));

  if (new Set(ids).size !== ids.length) {
    return <Notice hasError>{words.duplicateIds}</Notice>;
  }

  if (groups.length === 0 && status !== 'loading') {
    return <Notice>{words.empty}</Notice>;
  }

  return (
    <ToneScope ids={ids}>
      <div {...stylex.props(styles.board)}>
        {groups.map((group) => (
          <div key={group.id} {...stylex.props(styles.group)}>
            <BulletBar
              title={group.title}
              description={group.description}
              locale={locale}
              status={status}
              value={group.value}
              height="compact"
              selected={selected}
              onSelectedChange={onSelectedChange}
              rows={group.rows.map(({ id, label, value, target, ranges }) => ({ id, label, value, target, ranges }))}
            />
            {status !== 'loading' && (
              <ul aria-label={`${group.title}: state of each objective`} {...stylex.props(styles.states)}>
                {group.rows.map((row) => (
                  <li key={row.id} {...stylex.props(styles.state, row.id === selected && styles.isSelected)}>
                    <span {...stylex.props(styles.name)}>
                      {row.label}
                      <Text variant="caption" tone="muted">
                        {` · ${words.measured} ${formatValue({ value: row.value, locale, format: group.value.format })}, ${words.target.toLowerCase()} ${formatValue({ value: row.target, locale, format: group.value.format })}`}
                      </Text>
                    </span>
                    <Status tone={row.tone}>{row.state}</Status>
                    {row.detail !== undefined && <span {...stylex.props(styles.note)}>{row.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </ToneScope>
  );
}
