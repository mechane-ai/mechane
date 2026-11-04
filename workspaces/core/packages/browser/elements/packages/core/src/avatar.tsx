import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, radii, typography } from '../../foundations/src/tokens.stylex.ts';

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
});

type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  readonly label: string;
  readonly fallback: string;
  readonly src?: string;
  readonly size?: AvatarSize;
};

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
