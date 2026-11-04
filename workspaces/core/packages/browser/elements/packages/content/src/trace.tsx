import * as stylex from '@stylexjs/stylex';
import { Check, Circle, CircleDashed, CircleHelp, Clock, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Collapsible, TextButton } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  list: {
    margin: 0,
    padding: 0,
    listStyleType: 'none',
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  item: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '16px minmax(0, 1fr)',
    columnGap: spacing.md,
    paddingBottom: spacing.lg,
  },
  marker: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xxs },
  line: { width: 1, minHeight: spacing.lg, flex: 1, backgroundColor: colors.line },
  content: { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0 },
  label: { fontWeight: 500, overflowWrap: 'anywhere' },
  selected: { textDecorationLine: 'underline', textUnderlineOffset: 3 },
  status: { fontSize: typography.captionSize, lineHeight: typography.captionLineHeight, color: colors.muted },
  description: { margin: 0, color: colors.muted, overflowWrap: 'anywhere' },
  pending: { color: colors.muted },
  running: { color: colors.ink },
  complete: { color: colors.accent },
  failed: { color: colors.danger },
  skipped: { color: colors.muted },
  unknown: { color: colors.muted },
  group: { marginTop: spacing.md },
});

export type TraceStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped' | 'unknown';
export type TraceRootProps = { readonly label: string; readonly children: ReactNode };
export type TraceGroupProps = { readonly label: string; readonly children: ReactNode };

type TraceSelection =
  | { readonly selected: boolean; readonly onSelect: (id: string) => void }
  | { readonly selected?: never; readonly onSelect?: never };

export type TraceItemProps = TraceSelection & {
  readonly id: string;
  readonly label: string;
  readonly status: TraceStatus;
  readonly statusLabel: string;
  readonly description?: string;
  readonly detail?: ReactNode;
  readonly children?: ReactNode;
};

const tones = {
  pending: styles.pending,
  running: styles.running,
  complete: styles.complete,
  failed: styles.failed,
  skipped: styles.skipped,
  unknown: styles.unknown,
} satisfies Record<TraceStatus, stylex.StyleXStyles>;

const icons = {
  pending: Clock,
  running: Circle,
  complete: Check,
  failed: X,
  skipped: CircleDashed,
  unknown: CircleHelp,
} satisfies Record<TraceStatus, typeof Circle>;

function TraceRoot({ label, children }: TraceRootProps): ReactNode {
  return (
    <ol aria-label={label} {...stylex.props(styles.list)}>
      {children}
    </ol>
  );
}

function TraceGroup({ label, children }: TraceGroupProps): ReactNode {
  return (
    <ol aria-label={label} {...stylex.props(styles.list, styles.group)}>
      {children}
    </ol>
  );
}

function TraceItem({
  id,
  label,
  status,
  statusLabel,
  description,
  detail,
  selected,
  onSelect,
  children,
}: TraceItemProps): ReactNode {
  const Icon = icons[status];

  return (
    <li data-item-id={id} {...stylex.props(styles.item)}>
      <div aria-hidden {...stylex.props(styles.marker)}>
        <Icon size={14} {...stylex.props(tones[status])} />
        <span {...stylex.props(styles.line)} />
      </div>
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.label, selected === true && styles.selected)}>
          {onSelect === undefined ? (
            label
          ) : (
            <TextButton aria-pressed={selected} onClick={() => onSelect(id)}>
              {label}
            </TextButton>
          )}
        </div>
        <span {...stylex.props(styles.status)}>{statusLabel}</span>
        {description !== undefined && <p {...stylex.props(styles.description)}>{description}</p>}
        {detail !== undefined && (
          <Collapsible.Root>
            <Collapsible.Trigger>Details</Collapsible.Trigger>
            <Collapsible.Panel>{detail}</Collapsible.Panel>
          </Collapsible.Root>
        )}
        {children}
      </div>
    </li>
  );
}

export const Trace = { Root: TraceRoot, Item: TraceItem, Group: TraceGroup };
