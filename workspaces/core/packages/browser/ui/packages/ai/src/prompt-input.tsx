import * as stylex from '@stylexjs/stylex';
import { ArrowUp, Square } from 'lucide-react';
import { useId } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode, SubmitEvent } from 'react';
import { Button, Field, Textarea } from '../../core/src/index.ts';
import { spacing } from '../../core/src/tokens.stylex.ts';

const styles = stylex.create({
  form: { display: 'flex', flexDirection: 'column', gap: spacing.md, minWidth: 0 },
  footer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
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
        <Field.Label>{label}</Field.Label>
        <Textarea
          name={name}
          value={value}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          readOnly={pending}
          aria-errormessage={error === undefined ? undefined : feedbackId}
        />
        {description !== undefined && <Field.Description>{description}</Field.Description>}
        {error !== undefined && (
          <Field.Error id={feedbackId} match={true} role="alert">
            {error}
          </Field.Error>
        )}
      </Field.Root>
      {attachments}
      <div {...stylex.props(styles.footer)}>
        <div {...stylex.props(styles.controls)}>{controls}</div>
        {onStop === undefined ? (
          <Button
            type="submit"
            variant="solid"
            disabled={disabled || submitDisabled}
            pending={pending}
            pendingLabel={pendingLabel}
          >
            <ArrowUp size={16} aria-hidden />
            {submitLabel}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={(event) => {
              // The action can replace this button with Send before the click default runs.
              event.preventDefault();
              onStop();
            }}
            disabled={disabled}
            pending={stopPending}
            pendingLabel="Stopping…"
          >
            <Square size={14} aria-hidden />
            {stopLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
