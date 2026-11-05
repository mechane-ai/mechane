import * as stylex from '@stylexjs/stylex';
import { ArrowUp, Square } from 'lucide-react';
import { useId } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode, SubmitEvent } from 'react';
import { IconButton } from '../../core/src/index.ts';
import { Field, Textarea } from '../../forms/src/index.ts';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { colors, controls as controlTokens, radii, spacing } from '../../foundations/src/tokens.stylex.ts';
import { Tooltip } from '../../overlays/src/index.ts';

const styles = stylex.create({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    minWidth: 0,
    width: '100%',
    maxWidth: '80ch',
    marginInline: 'auto',
  },
  frame: {
    'display': 'flex',
    'flexDirection': 'column',
    'gap': spacing.sm,
    'minWidth': 0,
    'padding': spacing.md,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.md,
    'backgroundColor': colors.canvas,
    ':focus-within': {
      borderColor: colors.focus,
      outlineWidth: controlTokens.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -1,
    },
  },
  invalid: { borderColor: colors.danger },
  footer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: '1 1 auto' },
  action: { marginInlineStart: 'auto' },
});

export type PromptInputProps = {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onSubmit: NonNullable<ComponentProps<'form'>['onSubmit']>;
  readonly name?: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly required?: boolean;
  readonly pending?: boolean;
  readonly disabled?: boolean;
  readonly submitDisabled?: boolean;
  readonly submitLabel?: string;
  readonly pendingLabel?: string;
  readonly enterBehavior?: 'newline' | 'submit';
  readonly compact?: boolean;
  readonly description?: ReactNode;
  readonly error?: string | undefined;
  readonly controls?: ReactNode;
  readonly attachments?: ReactNode;
  readonly onStop?: (() => void) | undefined;
  readonly stopPending?: boolean;
  readonly stopLabel?: string;
};

export function PromptInput({
  label,
  value,
  onValueChange,
  onSubmit,
  name = 'prompt',
  placeholder,
  maxLength,
  required = true,
  pending = false,
  disabled = false,
  submitDisabled = false,
  submitLabel = 'Send message',
  pendingLabel = 'Sending…',
  enterBehavior = 'newline',
  compact = false,
  description,
  error,
  controls,
  attachments,
  onStop,
  stopPending = false,
  stopLabel = 'Stop response',
}: PromptInputProps): ReactNode {
  const feedbackId = useId();
  const inputDisabled = disabled || pending;
  let tooltipLabel = submitLabel;

  if (onStop !== undefined) {
    tooltipLabel = stopPending ? 'Stopping…' : stopLabel;
  } else if (pending) {
    tooltipLabel = pendingLabel;
  } else if (enterBehavior === 'submit') {
    tooltipLabel = `${submitLabel} · Enter`;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (enterBehavior !== 'submit' || event.key !== 'Enter' || event.repeat) {
      return;
    }

    const hasCommandModifier = event.altKey || event.ctrlKey || event.metaKey;

    if (event.shiftKey || hasCommandModifier) {
      return;
    }

    // oxlint-disable-next-line typescript/no-deprecated -- WebKit can clear isComposing before IME Enter (keyCode 229).
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }

    event.preventDefault();

    if (!inputDisabled && !submitDisabled && onStop === undefined) {
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!inputDisabled && !submitDisabled && onStop === undefined) {
      onSubmit(event);
    }
  }

  return (
    <form onSubmit={handleSubmit} {...stylex.props(styles.form)}>
      <Field.Root invalid={error !== undefined}>
        <Field.Label {...stylex.props(accessibility.hidden)}>{label}</Field.Label>
        <div {...stylex.props(styles.frame, error !== undefined && styles.invalid)}>
          <Textarea
            appearance="plain"
            rows={compact ? 1 : 2}
            compact={compact}
            name={name}
            value={value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? label}
            maxLength={maxLength}
            required={required}
            disabled={disabled}
            readOnly={pending}
            aria-errormessage={error === undefined ? undefined : feedbackId}
          />
          {attachments}
          <div {...stylex.props(styles.footer)}>
            {controls !== undefined && <div {...stylex.props(styles.controls)}>{controls}</div>}
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  onStop === undefined ? (
                    <IconButton
                      xstyle={styles.action}
                      type="submit"
                      variant="solid"
                      aria-label={pending ? pendingLabel : submitLabel}
                      disabled={disabled || submitDisabled}
                      pending={pending}
                    >
                      <ArrowUp size={16} aria-hidden />
                    </IconButton>
                  ) : (
                    <IconButton
                      xstyle={styles.action}
                      type="button"
                      aria-label={stopPending ? 'Stopping…' : stopLabel}
                      onClick={(event) => {
                        // The action can replace this button with Send before the click default runs.
                        event.preventDefault();
                        onStop();
                      }}
                      disabled={disabled}
                      pending={stopPending}
                    >
                      <Square size={14} aria-hidden />
                    </IconButton>
                  )
                }
              />
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>{tooltipLabel}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        </div>
        {description !== undefined && <Field.Description>{description}</Field.Description>}
        {error !== undefined && (
          <Field.Error id={feedbackId} match={true} role="alert">
            {error}
          </Field.Error>
        )}
      </Field.Root>
    </form>
  );
}
