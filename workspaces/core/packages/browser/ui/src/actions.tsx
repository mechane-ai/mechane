import { Button as BaseButton } from '@base-ui/react/button';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  button: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'gap': 6,
    'padding': '0 11px',
    'minHeight': 32,
    'borderRadius': 4,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': 'inherit',
    'fontWeight': 500,
    'fontSize': 13,
    'lineHeight': '20px',
    'cursor': 'pointer',
    'whiteSpace': 'nowrap',
    ':hover': { backgroundColor: colors.canvas },
    ':disabled': { opacity: 0.45, cursor: 'default' },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.accent, outlineOffset: 2 },
  },
  primary: {
    'backgroundColor': colors.ink,
    'borderColor': colors.ink,
    'color': '#fff',
    ':hover': { backgroundColor: '#333' },
  },
  quiet: { borderColor: 'transparent', backgroundColor: 'transparent' },
  danger: { color: colors.danger },
  link: { 'color': colors.ink, 'textDecoration': 'none', ':hover': { textDecoration: 'underline' } },
});

export function Button({
  tone = 'normal',
  ...props
}: ComponentProps<typeof BaseButton> & { readonly tone?: 'normal' | 'primary' | 'quiet' | 'danger' }): ReactNode {
  return (
    <BaseButton
      {...props}
      {...stylex.props(
        styles.button,
        tone === 'primary' && styles.primary,
        tone === 'quiet' && styles.quiet,
        tone === 'danger' && styles.danger,
      )}
    />
  );
}

export function TextLink(props: ComponentProps<'a'>): ReactNode {
  return <a {...props} {...stylex.props(styles.link)} />;
}
