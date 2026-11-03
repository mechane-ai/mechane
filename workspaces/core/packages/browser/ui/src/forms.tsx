import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  input: {
    'display': 'block',
    'boxSizing': 'border-box',
    'width': '100%',
    'minHeight': 36,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': 4,
    'paddingBlock': 7,
    'paddingInline': 10,
    'fontFamily': 'inherit',
    'fontSize': 14,
    'lineHeight': '20px',
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: 1 },
    ':disabled': { color: colors.muted, backgroundColor: colors.canvas },
  },
  label: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: '20px', color: colors.ink },
  textarea: { minHeight: 144, resize: 'vertical', lineHeight: 1.6 },
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
