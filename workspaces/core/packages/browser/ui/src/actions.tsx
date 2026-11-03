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
    'paddingBlock': 0,
    'paddingInline': 10,
    'minHeight': 32,
    'borderRadius': 4,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': 'transparent',
    'backgroundColor': colors.canvas,
    'color': colors.ink,
    'fontFamily': 'inherit',
    'fontWeight': 500,
    'fontSize': 13,
    'lineHeight': '20px',
    'cursor': 'pointer',
    'whiteSpace': 'nowrap',
    ':hover': { backgroundColor: colors.line },
    ':disabled': { opacity: 0.45, cursor: 'default' },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: 2 },
  },
  labels: { display: 'inline-grid' },
  label: { gridArea: '1 / 1' },
  hidden: { visibility: 'hidden' },
  primary: {
    'backgroundColor': colors.ink,
    'borderColor': colors.ink,
    'color': '#fff',
    ':hover': { backgroundColor: '#333' },
  },
  quiet: { backgroundColor: 'transparent' },
  danger: { color: colors.danger },
  inline: {
    'display': 'inline-block',
    'justifyContent': 'flex-start',
    'minHeight': 20,
    'minWidth': 0,
    'paddingBlock': 0,
    'paddingInline': 0,
    'borderWidth': 0,
    'borderRadius': 0,
    'backgroundColor': 'transparent',
    'fontSize': 14,
    'fontWeight': 400,
    'maxWidth': '100%',
    'overflow': 'hidden',
    'textOverflow': 'ellipsis',
    'verticalAlign': 'middle',
    ':hover': { backgroundColor: 'transparent', textDecoration: 'underline' },
  },
  link: {
    'color': colors.ink,
    'textDecoration': 'none',
    ':hover': { textDecoration: 'underline' },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: 2 },
  },
});

export function Button({
  tone = 'normal',
  pendingLabel,
  pending = false,
  children,
  ...props
}: ComponentProps<typeof BaseButton> & {
  readonly tone?: 'normal' | 'primary' | 'quiet' | 'danger' | 'link';
  readonly pendingLabel?: string;
  readonly pending?: boolean;
}): ReactNode {
  return (
    <BaseButton
      {...props}
      aria-busy={pending || undefined}
      {...stylex.props(
        styles.button,
        tone === 'primary' && styles.primary,
        tone === 'quiet' && styles.quiet,
        tone === 'danger' && styles.danger,
        tone === 'link' && styles.inline,
      )}
    >
      {pendingLabel === undefined ? (
        children
      ) : (
        <span {...stylex.props(styles.labels)}>
          <span aria-hidden={pending} {...stylex.props(styles.label, pending && styles.hidden)}>
            {children}
          </span>
          <span aria-hidden={!pending} {...stylex.props(styles.label, !pending && styles.hidden)}>
            {pendingLabel}
          </span>
        </span>
      )}
    </BaseButton>
  );
}

export function TextLink(props: ComponentProps<'a'>): ReactNode {
  return <a {...props} {...stylex.props(styles.link)} />;
}
