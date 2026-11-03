import * as stylex from '@stylexjs/stylex';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  button: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'maxWidth': '100%',
    'gap': 6,
    'padding': 0,
    'borderWidth': 0,
    'backgroundColor': 'transparent',
    'color': colors.muted,
    'fontFamily': 'inherit',
    'fontSize': 13,
    'lineHeight': '20px',
    'textAlign': 'start',
    'cursor': 'pointer',
    ':hover': { color: colors.ink },
    ':focus-visible': { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 },
  },
  value: { minWidth: 0, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
  icon: { flexShrink: 0 },
});

const FEEDBACK_MS = 1600;

export function CopyValue({
  value,
  label,
  children,
}: {
  readonly value: string;
  readonly label: string;
  readonly children?: ReactNode;
}): ReactNode {
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (feedback === '') {
      return;
    }

    const timer = globalThis.setTimeout(() => setFeedback(''), FEEDBACK_MS);

    return () => globalThis.clearTimeout(timer);
  }, [feedback, value]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback('Copied');
    } catch {
      setFeedback(value);
    }
  }

  const Icon = feedback === 'Copied' ? Check : Copy;

  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={value}
      onClick={() => {
        void copy();
      }}
      {...stylex.props(styles.button)}
    >
      <span {...stylex.props(styles.value)}>{feedback === '' ? (children ?? value) : feedback}</span>
      <Icon size={12} aria-hidden {...stylex.props(styles.icon)} />
      <span role="status" className="sr-only">
        {feedback === 'Copied' ? `${label} copied` : ''}
      </span>
    </button>
  );
}
