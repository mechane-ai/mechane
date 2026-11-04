import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { Badge, Button, Row } from '../../core/src/index.ts';
import { colors, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  title: {
    margin: 0,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: 500,
    overflowWrap: 'anywhere',
  },
  description: { margin: 0, color: colors.muted, overflowWrap: 'anywhere' },
});

type PendingApproval = {
  readonly status: 'pending';
  readonly onApprove: () => void;
  readonly onDeny: () => void;
  readonly busy?: 'approve' | 'deny' | undefined;
  readonly disabled?: boolean;
  readonly approveLabel?: string;
  readonly denyLabel?: string;
  readonly statusLabel?: never;
};

type SettledApproval = {
  readonly status: 'approved' | 'denied' | 'expired';
  readonly statusLabel: string;
  readonly onApprove?: never;
  readonly onDeny?: never;
  readonly busy?: never;
  readonly disabled?: never;
  readonly approveLabel?: never;
  readonly denyLabel?: never;
};

export type ApprovalProps = (PendingApproval | SettledApproval) & {
  readonly requestId: string;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
};

export function Approval(props: ApprovalProps): ReactNode {
  return (
    <section aria-label={props.title} data-request-id={props.requestId} {...stylex.props(styles.root)}>
      <h3 {...stylex.props(styles.title)}>{props.title}</h3>
      {props.description !== undefined && <p {...stylex.props(styles.description)}>{props.description}</p>}
      {props.children}
      {props.status === 'pending' ? (
        <Row>
          <Button
            variant="solid"
            onClick={props.onApprove}
            disabled={props.disabled === true || props.busy !== undefined}
            pending={props.busy === 'approve'}
            pendingLabel="Approving…"
          >
            {props.approveLabel ?? 'Approve'}
          </Button>
          <Button
            onClick={props.onDeny}
            disabled={props.disabled === true || props.busy !== undefined}
            pending={props.busy === 'deny'}
            pendingLabel="Denying…"
          >
            {props.denyLabel ?? 'Deny'}
          </Button>
        </Row>
      ) : (
        <Badge>{props.statusLabel}</Badge>
      )}
    </section>
  );
}
