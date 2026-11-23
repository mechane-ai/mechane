import * as stylex from '@stylexjs/stylex';
import { createInputHistory, dispatch, isComposing } from '@ui-sdk/core';
import { matchesShortcut } from '@ui-sdk/core/shortcuts';
import { useShortcutHint } from '@ui-sdk/react/shortcuts';
import { ArrowUp, Square } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode, SubmitEvent } from 'react';
import { IconButton } from '../../core/src/index.ts';
import { ButtonPlaceholder, SkeletonText } from '../../feedback/src/index.ts';
import { Field, Textarea } from '../../forms/src/index.ts';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import { colors, controls as controlTokens, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
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
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
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
  inlineFrame: { flexDirection: 'row', alignItems: 'flex-end', paddingBlock: spacing.sm },
  inlineInput: { flex: '1 1 auto', alignSelf: 'center' },
  inlineFooter: { flexShrink: 0 },
  footer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: '1 1 auto' },
  action: { marginInlineStart: 'auto' },
  placeholderControls: { fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
});

const SUBMIT_SHORTCUT = 'mod+enter';

export type PromptInputPlaceholderProps = { readonly isCompact?: boolean };

export function PromptInputPlaceholder({ isCompact = false }: PromptInputPlaceholderProps): ReactNode {
  return (
    <div aria-hidden inert {...stylex.props(styles.form)}>
      <div {...stylex.props(styles.frame)}>
        <div
          {...stylex.props(
            controlStyles.base,
            controlStyles.field,
            controlStyles.textarea,
            controlStyles.plainTextarea,
          )}
        >
          <SkeletonText lines={isCompact ? 1 : 2} width="22ch" />
        </div>
        <div {...stylex.props(styles.footer)}>
          <div {...stylex.props(styles.controls, styles.placeholderControls)}>
            <SkeletonText width="8ch" />
          </div>
          <ButtonPlaceholder isIconOnly xstyle={styles.action} />
        </div>
      </div>
    </div>
  );
}

export type PromptInputProps = {
  readonly label: string;
  readonly value: string;
  /** The new text, then the UI SDK change details. */
  readonly onValueChange: NonNullable<ComponentProps<typeof Textarea>['onValueChange']>;
  readonly onSubmit: NonNullable<ComponentProps<'form'>['onSubmit']>;
  readonly name?: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly required?: boolean;
  readonly isPending?: boolean;
  readonly disabled?: boolean;
  readonly isSubmitDisabled?: boolean;
  readonly submitLabel?: string;
  readonly pendingLabel?: string;
  /** What a plain Enter does. Command or Control with Enter always submits, and Shift with Enter always adds a line. */
  readonly enterBehavior?: 'newline' | 'submit';
  /** Earlier prompts, oldest first. Arrow Up on the first line brings one back, and Arrow Down returns to the draft. */
  readonly history?: ReadonlyArray<string>;
  readonly isCompact?: boolean;
  readonly description?: ReactNode;
  readonly error?: string | undefined;
  readonly controls?: ReactNode;
  readonly attachments?: ReactNode;
  readonly onStop?: (() => void) | undefined;
  readonly isStopPending?: boolean;
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
  isPending = false,
  disabled = false,
  isSubmitDisabled = false,
  submitLabel = 'Send message',
  pendingLabel = 'Sending…',
  enterBehavior = 'newline',
  history,
  isCompact = false,
  description,
  error,
  controls,
  attachments,
  onStop,
  isStopPending = false,
  stopLabel = 'Stop response',
}: PromptInputProps): ReactNode {
  const feedbackId = useId();
  const isInputDisabled = disabled;
  const isInline = isCompact && attachments === undefined && controls === undefined;
  const canSubmit = !isInputDisabled && !isPending && !isSubmitDisabled;
  const submitHint = useShortcutHint(SUBMIT_SHORTCUT);
  const latest = useRef({ history, value, onValueChange });

  useLayoutEffect(() => {
    latest.current = { history, value, onValueChange };
  });

  const [earlier] = useState(() =>
    createInputHistory<string>({
      entries: () => latest.current.history,
      read: () => latest.current.value,
      write: (next, event) =>
        !dispatch({ options: () => latest.current }, 'onValueChange', next, { reason: 'input-change', event }),
    }),
  );

  let tooltipLabel = `${submitLabel} · ${submitHint.text}`;

  if (onStop !== undefined) {
    tooltipLabel = isStopPending ? 'Stopping…' : stopLabel;
  } else if (isPending) {
    tooltipLabel = pendingLabel;
  } else if (enterBehavior === 'submit') {
    tooltipLabel = `${submitLabel} · Enter`;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (earlier.keydown(event.nativeEvent)) {
      return;
    }

    // An input method's Enter chooses a candidate, so it never submits.
    if (event.key !== 'Enter' || event.repeat || isComposing(event)) {
      return;
    }

    const isCommandEnter = matchesShortcut(event.nativeEvent, SUBMIT_SHORTCUT);
    const isPlainEnter = !isCommandEnter && matchesShortcut(event.nativeEvent, 'enter');

    if (!isCommandEnter && (enterBehavior !== 'submit' || !isPlainEnter)) {
      return;
    }

    event.preventDefault();

    if (canSubmit && onStop === undefined) {
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (canSubmit && onStop === undefined) {
      onSubmit(event);
    }
  }

  return (
    <form onSubmit={handleSubmit} {...stylex.props(styles.form)}>
      <Field.Root invalid={error !== undefined}>
        <Field.Label {...stylex.props(accessibility.hidden)}>{label}</Field.Label>
        <div {...stylex.props(styles.frame, isInline && styles.inlineFrame, error !== undefined && styles.invalid)}>
          <Textarea
            isSensitive
            appearance="plain"
            rows={isCompact ? 1 : 2}
            isCompact={isCompact}
            shouldGrow={isInline}
            xstyle={isInline ? styles.inlineInput : undefined}
            name={name}
            value={value}
            onValueChange={onValueChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? label}
            maxLength={maxLength}
            required={required}
            disabled={disabled}
            aria-errormessage={error === undefined ? undefined : feedbackId}
          />
          {attachments}
          <div {...stylex.props(styles.footer, isInline && styles.inlineFooter)}>
            {controls !== undefined && <div {...stylex.props(styles.controls)}>{controls}</div>}
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  onStop === undefined ? (
                    <IconButton
                      xstyle={styles.action}
                      type="submit"
                      data-agent-confirm={submitLabel}
                      variant="solid"
                      aria-label={isPending ? pendingLabel : submitLabel}
                      aria-keyshortcuts={
                        enterBehavior === 'submit'
                          ? `Enter ${submitHint.ariaKeyshortcuts}`
                          : submitHint.ariaKeyshortcuts
                      }
                      disabled={disabled || isSubmitDisabled}
                      isPending={isPending}
                    >
                      <ArrowUp size={16} aria-hidden />
                    </IconButton>
                  ) : (
                    <IconButton
                      xstyle={styles.action}
                      type="button"
                      data-agent-confirm={stopLabel}
                      aria-label={isStopPending ? 'Stopping…' : stopLabel}
                      onClick={(event) => {
                        // The action can replace this button with Send before the click default runs.
                        event.preventDefault();
                        onStop();
                      }}
                      disabled={disabled}
                      isPending={isStopPending}
                    >
                      <Square size={14} aria-hidden />
                    </IconButton>
                  )
                }
              />
              <Tooltip.Popup>{tooltipLabel}</Tooltip.Popup>
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
