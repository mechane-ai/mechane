import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors, controls, layers, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  link: {
    'position': 'fixed',
    'top': spacing.md,
    'left': spacing.md,
    'zIndex': layers.skipLink,
    'transform': 'translateY(calc(-100% - 16px))',
    'padding': spacing.md,
    'boxSizing': 'border-box',
    'maxWidth': 'calc(100vw - 24px)',
    'borderRadius': radii.sm,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'WebkitFontSmoothing': 'antialiased',
    'textDecorationLine': 'underline',
    ':focus': {
      transform: 'translateY(0)',
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
});

type SkipLinkProps = Omit<ComponentProps<'a'>, 'href'> & { readonly href: string };

export function SkipLink(props: SkipLinkProps): ReactNode {
  return <a {...mergeProps(stylex.props(styles.link), props)} />;
}
