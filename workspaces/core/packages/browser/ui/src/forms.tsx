import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  input: {
    'display': 'block',
    'boxSizing': 'border-box',
    'width': '100%',
    'minHeight': 34,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': 4,
    'padding': '7px 9px',
    'fontFamily': 'inherit',
    'fontSize': 13,
    ':focus': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.accent, outlineOffset: 1 },
  },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 500, color: colors.muted },
  textarea: { minHeight: 120, resize: 'vertical', lineHeight: 1.6 },
});

export function TextField({ label, ...props }: ComponentProps<'input'> & { readonly label: string }): ReactNode {
  return (
    <label {...stylex.props(styles.label)}>
      {label}
      <input {...props} {...stylex.props(styles.input)} />
    </label>
  );
}

export function TextArea({ label, ...props }: ComponentProps<'textarea'> & { readonly label: string }): ReactNode {
  return (
    <label {...stylex.props(styles.label)}>
      {label}
      <textarea {...props} {...stylex.props(styles.input, styles.textarea)} />
    </label>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: ComponentProps<'select'> & { readonly label: string }): ReactNode {
  return (
    <label {...stylex.props(styles.label)}>
      {label}
      <select {...props} {...stylex.props(styles.input)}>
        {children}
      </select>
    </label>
  );
}
