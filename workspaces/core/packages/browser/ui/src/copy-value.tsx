import { Button as BaseButton } from '@base-ui/react/button';
import { mergeProps } from '@base-ui/react/merge-props';
import { colors, conditions, controls, typography } from '@mechane/ui-tokens/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { accessibility } from './accessibility.ts';
import { mergeStyles } from './style-composition.ts';

const styles = stylex.create({
  button: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'maxWidth': '100%',
    'minHeight': { default: typography.bodyLineHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'gap': controls.gap,
    'padding': 0,
    'borderWidth': 0,
    'backgroundColor': 'transparent',
    'color': colors.muted,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'textAlign': 'start',
    'cursor': 'pointer',
    ':hover:not([data-disabled])': { color: colors.ink },
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: 2,
    },
  },
  value: { minWidth: 0, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums', userSelect: 'text' },
  icon: { flexShrink: 0 },
});

const FEEDBACK_MS = 1600;
type CopyStatus = 'idle' | 'pending' | 'copied' | 'failed';
const feedbackStates: ReadonlySet<CopyStatus> = new Set(['copied', 'failed']);
type CopyFeedback = { readonly value: string; readonly status: CopyStatus };

type CopyValueProps = Omit<ComponentProps<typeof BaseButton>, 'value'> & {
  readonly value: string;
  readonly label: string;
};

export function CopyValue({
  value,
  label,
  children,
  className,
  style,
  disabled = false,
  onClick,
  ...props
}: CopyValueProps): ReactNode {
  const [feedback, setFeedback] = useState<CopyFeedback>({ value, status: 'idle' });
  const operation = useRef(0);
  const status = feedback.value === value ? feedback.status : 'idle';

  useEffect(
    () => () => {
      operation.current += 1;
    },
    [value],
  );

  useEffect(() => {
    if (!feedbackStates.has(feedback.status)) {
      return;
    }

    const timer = globalThis.setTimeout(() => {
      setFeedback((current) => (current === feedback ? { value, status: 'idle' } : current));
    }, FEEDBACK_MS);

    return () => globalThis.clearTimeout(timer);
  }, [feedback, value]);

  async function copy(): Promise<void> {
    operation.current += 1;
    const request = operation.current;

    setFeedback({ value, status: 'pending' });

    try {
      await navigator.clipboard.writeText(value);

      if (operation.current === request) {
        setFeedback({ value, status: 'copied' });
      }
    } catch {
      if (operation.current === request) {
        setFeedback({ value, status: 'failed' });
      }
    }
  }

  const Icon = status === 'copied' ? Check : Copy;

  const messages = {
    idle: '',
    pending: '',
    copied: `${label} copied`,
    failed: `Could not copy ${label}. Select and copy the value.`,
  } satisfies Record<CopyStatus, string>;

  const events = mergeProps<'button'>(
    {
      onClick: () => {
        void copy();
      },
    },
    { onClick },
  );

  return (
    <BaseButton
      {...props}
      {...events}
      {...mergeStyles<BaseButton.State>({ className, style, styles: stylex.props(styles.button) })}
      type="button"
      aria-label={`Copy ${label}`}
      aria-busy={status === 'pending' || props['aria-busy']}
      disabled={disabled || status === 'pending'}
      title={value}
    >
      <span {...stylex.props(styles.value)}>{status === 'copied' ? 'Copied' : (children ?? value)}</span>
      <Icon size={12} aria-hidden {...stylex.props(styles.icon)} />
      <span role="status" {...stylex.props(accessibility.hidden)}>
        {messages[status]}
      </span>
    </BaseButton>
  );
}
