import * as stylex from '@stylexjs/stylex';
import { Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Collapsible } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { CommandDetails } from './command-details.tsx';
import type { CommandDetailsProps } from './command-details.tsx';

export type CommandStatus = 'pending' | 'running' | 'complete' | 'failed' | 'stopped' | 'unknown';
export type CommandActivityProps = Omit<CommandDetailsProps, 'isRunning'> & { readonly status: CommandStatus };

const styles = stylex.create({
  summary: { display: 'inline-flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  command: {
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'pre',
  },
  icon: { flexShrink: 0 },
  status: { flexShrink: 0, fontSize: typography.captionSize, color: colors.muted },
});

const statusLabels: Record<CommandStatus, string> = {
  pending: 'Preparing',
  running: 'Running',
  complete: '',
  failed: 'Failed',
  stopped: 'Stopped',
  unknown: 'Outcome unknown',
};

const activeStatuses: ReadonlySet<CommandStatus> = new Set(['pending', 'running']);

export function CommandActivity({ status, ...details }: CommandActivityProps): ReactNode {
  const firstLine = details.command?.trim().split(/\r\n|\n|\r/u)[0];
  const label = firstLine === undefined || firstLine.length === 0 ? 'Command' : firstLine;

  return (
    <Collapsible.Root defaultOpen={false}>
      <Collapsible.Trigger variant="inline">
        <span {...stylex.props(styles.summary)}>
          <Terminal size={14} aria-hidden {...stylex.props(styles.icon)} />
          <span {...stylex.props(styles.command)}>{label}</span>
          {statusLabels[status].length > 0 && <span {...stylex.props(styles.status)}>{statusLabels[status]}</span>}
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <CommandDetails {...details} isRunning={activeStatuses.has(status)} />
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
