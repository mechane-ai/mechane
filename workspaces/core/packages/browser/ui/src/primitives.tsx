import { Button as BaseButton } from '@base-ui/react/button';
import * as stylex from '@stylexjs/stylex';
import { Box, Circle, Layers3 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  button: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'gap': 8,
    'padding': '9px 14px',
    'minHeight': 38,
    'borderRadius': 7,
    'border': `1px solid ${colors.line}`,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'font': 'inherit',
    'fontWeight': 550,
    'fontSize': 13,
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
    ':disabled': { opacity: 0.5, cursor: 'default' },
    ':focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: 3 },
  },
  primary: {
    'backgroundColor': colors.accent,
    'borderColor': colors.accent,
    'color': '#ffffff',
    ':hover': { backgroundColor: '#12574e' },
  },
  quiet: { borderColor: 'transparent', backgroundColor: 'transparent' },
  dangerButton: { color: colors.danger, borderColor: '#e9c9cc' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 5,
    padding: '4px 7px',
    color: colors.muted,
    backgroundColor: colors.canvas,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  positive: { color: colors.accent, backgroundColor: colors.accentSoft },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  panel: { border: `1px solid ${colors.line}`, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden' },
  padded: { padding: 22 },
  row: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  stack: { display: 'flex', flexDirection: 'column', gap: 20 },
  smallStack: { gap: 8 },
  heading: { margin: 0, fontSize: 25, fontWeight: 620, letterSpacing: '-0.7px', color: colors.ink },
  subheading: { margin: 0, fontSize: 14, fontWeight: 600, color: colors.ink },
  muted: { margin: 0, color: colors.muted, fontSize: 13, lineHeight: 1.65 },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    color: colors.muted,
    overflowWrap: 'anywhere',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '52px 24px',
    gap: 12,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    display: 'grid',
    placeItems: 'center',
    color: colors.muted,
    backgroundColor: colors.canvas,
    border: `1px solid ${colors.line}`,
    borderRadius: 11,
    marginBottom: 4,
  },
  notice: {
    padding: '12px 16px',
    borderRadius: 7,
    fontSize: 13,
    lineHeight: 1.6,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    overflowWrap: 'anywhere',
  },
  input: {
    'display': 'block',
    'boxSizing': 'border-box',
    'width': '100%',
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'border': `1px solid ${colors.line}`,
    'borderRadius': 7,
    'padding': '10px 12px',
    'font': 'inherit',
    'fontSize': 13,
    ':focus': { outline: `2px solid ${colors.accent}`, outlineOffset: 1 },
  },
  label: { display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12, fontWeight: 550, color: colors.ink },
  textarea: { minHeight: 110, resize: 'vertical', lineHeight: 1.6 },
  divider: { border: 0, borderTop: `1px solid ${colors.line}`, margin: '0' },
  link: {
    'color': colors.accent,
    'textDecoration': 'none',
    ':hover': { textDecoration: 'underline' },
    ':focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: 3 },
  },
  prose: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: 13,
    lineHeight: 1.75,
    margin: 0,
    color: colors.ink,
    fontFamily: 'inherit',
  },
});

type Children = { readonly children: ReactNode };
type Tone = 'neutral' | 'positive' | 'warning' | 'negative';

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
        tone === 'danger' && styles.dangerButton,
      )}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: Children & { readonly tone?: Tone }): ReactNode {
  return (
    <span
      {...stylex.props(
        styles.badge,
        tone === 'positive' && styles.positive,
        tone === 'warning' && styles.warning,
        tone === 'negative' && styles.negative,
      )}
    >
      <Circle size={5} fill="currentColor" aria-hidden />
      {children}
    </span>
  );
}

export function Panel({ children, padded = true }: Children & { readonly padded?: boolean }): ReactNode {
  return <section {...stylex.props(styles.panel, padded && styles.padded)}>{children}</section>;
}

export function Row({ children, between = false }: Children & { readonly between?: boolean }): ReactNode {
  return <div {...stylex.props(styles.row, between && styles.between)}>{children}</div>;
}

export function Stack({ children, compact = false }: Children & { readonly compact?: boolean }): ReactNode {
  return <div {...stylex.props(styles.stack, compact && styles.smallStack)}>{children}</div>;
}

export function Heading({ children }: Children): ReactNode {
  return <h1 {...stylex.props(styles.heading)}>{children}</h1>;
}

export function Subheading({ children }: Children): ReactNode {
  return <h2 {...stylex.props(styles.subheading)}>{children}</h2>;
}

export function Muted({ children }: Children): ReactNode {
  return <p {...stylex.props(styles.muted)}>{children}</p>;
}

export function Identifier({ children }: Children): ReactNode {
  return <span {...stylex.props(styles.mono)}>{children}</span>;
}

export function Prose({ children }: Children): ReactNode {
  return <pre {...stylex.props(styles.prose)}>{children}</pre>;
}

export function Divider(): ReactNode {
  return <hr {...stylex.props(styles.divider)} />;
}

export function EmptyState({
  title,
  children,
  action,
}: Children & { readonly title: string; readonly action?: ReactNode }): ReactNode {
  return (
    <div {...stylex.props(styles.empty)}>
      <div {...stylex.props(styles.emptyIcon)}>
        <Box size={21} aria-hidden />
      </div>
      <Subheading>{title}</Subheading>
      <Muted>{children}</Muted>
      {action}
    </div>
  );
}

export function Notice({ children, error = false }: Children & { readonly error?: boolean }): ReactNode {
  return (
    <div role={error ? 'alert' : 'status'} {...stylex.props(styles.notice, error && styles.negative)}>
      {children}
    </div>
  );
}

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

export function TextLink({ children, ...props }: ComponentProps<'a'>): ReactNode {
  return (
    <a {...props} {...stylex.props(styles.link)}>
      {children}
    </a>
  );
}

export function Brand(): ReactNode {
  return (
    <Row>
      <Layers3 size={22} aria-hidden />
      <strong>mechane</strong>
      <Badge>Console</Badge>
    </Row>
  );
}
