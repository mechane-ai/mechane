import * as stylex from '@stylexjs/stylex';
import { GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';
import { Collapsible } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: { minWidth: 0, borderBlockWidth: 1, borderBlockStyle: 'solid', borderBlockColor: colors.line },
  trigger: {
    justifyContent: 'start',
    gap: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.regularWeight,
  },
  icon: { flexShrink: 0 },
  label: { minWidth: 0, overflowWrap: 'anywhere' },
  content: { color: colors.muted, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
});

export type MessageBoundaryProps = { readonly label: string; readonly children: ReactNode };

export function MessageBoundary({ label, children }: MessageBoundaryProps): ReactNode {
  return (
    <Collapsible.Root {...stylex.props(styles.root)}>
      <Collapsible.Trigger {...stylex.props(styles.trigger)}>
        <GitBranch size={14} aria-hidden {...stylex.props(styles.icon)} />
        <span {...stylex.props(styles.label)}>{label}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel {...stylex.props(styles.content)}>{children}</Collapsible.Panel>
    </Collapsible.Root>
  );
}
