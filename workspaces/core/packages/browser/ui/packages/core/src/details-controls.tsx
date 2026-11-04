import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  avatar: {
    display: 'inline-flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    fontWeight: 500,
  },
  small: { width: 24, height: 24 },
  medium: { width: 32, height: 32 },
  large: { width: 40, height: 40 },
  image: { width: '100%', height: '100%', objectFit: 'cover' },
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
  timestamp: {
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.muted,
    fontVariantNumeric: 'tabular-nums',
  },
});

type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  readonly label: string;
  readonly fallback: string;
  readonly src?: string;
  readonly size?: AvatarSize;
};

export type SettingsRowProps = {
  readonly label: string;
  readonly description?: string;
  readonly controlId: string;
  readonly children: ReactNode;
};

export type TimestampProps = { readonly dateTime: string; readonly label: string; readonly title?: string };

const sizes = { sm: styles.small, md: styles.medium, lg: styles.large } satisfies Record<
  AvatarSize,
  stylex.StyleXStyles
>;

export function Avatar({ label, fallback, src, size = 'md' }: AvatarProps): ReactNode {
  return (
    <BaseAvatar.Root role="img" aria-label={label} {...stylex.props(styles.avatar, sizes[size])}>
      {src !== undefined && <BaseAvatar.Image src={src} alt="" {...stylex.props(styles.image)} />}
      <BaseAvatar.Fallback aria-hidden>{fallback}</BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}

export function SettingsRow({ label, description, controlId, children }: SettingsRowProps): ReactNode {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} {...stylex.props(styles.setting)}>
      <div {...stylex.props(styles.explanation)}>
        <label id={labelId} htmlFor={controlId} {...stylex.props(styles.label)}>
          {label}
        </label>
        {description !== undefined && <p {...stylex.props(styles.description)}>{description}</p>}
      </div>
      <div {...stylex.props(styles.control)}>{children}</div>
    </div>
  );
}

export function Timestamp({ dateTime, label, title }: TimestampProps): ReactNode {
  return (
    <time dateTime={dateTime} title={title} {...stylex.props(styles.timestamp)}>
      {label}
    </time>
  );
}
