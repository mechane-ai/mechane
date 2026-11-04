import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  setting: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingBlock: spacing.lg,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  explanation: { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0, flex: '1 1 240px' },
  label: { fontWeight: 500 },
  description: { margin: 0, color: colors.muted, overflowWrap: 'anywhere' },
  control: { minWidth: 0, flexShrink: 0 },
});

export type SettingsRowProps = {
  readonly label: string;
  readonly description?: string;
  readonly controlId: string;
  readonly children: ReactNode;
};

export function SettingsRow({ label, description, controlId, children }: SettingsRowProps): ReactNode {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} {...stylex.props(styles.setting)}>
      <div {...stylex.props(styles.explanation)}>
        <label id={labelId} htmlFor={controlId} {...stylex.props(styles.label)}>
          {label}
        </label>
        {description !== undefined && (
          <p id={`${controlId}-description`} {...stylex.props(styles.description)}>
            {description}
          </p>
        )}
      </div>
      <div {...stylex.props(styles.control)}>{children}</div>
    </div>
  );
}
