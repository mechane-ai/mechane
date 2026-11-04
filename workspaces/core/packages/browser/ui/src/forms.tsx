import { Field as BaseField } from '@base-ui/react/field';
import { Input as BaseInput } from '@base-ui/react/input';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { TextValueProperties } from './control-state.ts';
import { mergeStyles } from './style-composition.ts';
import type { PlacementStyle } from './style-composition.ts';
import { colors, conditions, controls, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0, fontFamily: typography.fontFamily },
  label: { color: colors.ink, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  description: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  error: { color: colors.danger, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  input: {
    'display': 'block',
    'boxSizing': 'border-box',
    'width': '100%',
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.sm,
    'paddingBlock': 7,
    'paddingInline': controls.paddingInline,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.inputSize,
    'lineHeight': typography.bodyLineHeight,
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 1,
    },
    ':is([data-invalid], [aria-invalid="true"])': { borderColor: colors.danger },
    ':disabled': { color: colors.muted, backgroundColor: colors.canvas, cursor: 'not-allowed' },
    '::placeholder': { color: colors.muted },
  },
  textarea: { minHeight: 144, resize: 'vertical', lineHeight: 1.6 },
});

type FieldRootProps = ComponentProps<typeof BaseField.Root> & { readonly xstyle?: PlacementStyle };
type FieldLabelProps = ComponentProps<typeof BaseField.Label>;
type FieldDescriptionProps = ComponentProps<typeof BaseField.Description>;
type FieldErrorProps = ComponentProps<typeof BaseField.Error>;
type BaseInputProps = ComponentProps<typeof BaseInput>;

type InputProps = Omit<BaseInputProps, 'value' | 'defaultValue' | 'onChange' | 'onValueChange' | 'readOnly'> &
  TextValueProperties<
    NonNullable<BaseInputProps['value']>,
    NonNullable<BaseInputProps['onChange']>,
    NonNullable<BaseInputProps['onValueChange']>
  > & { readonly xstyle?: PlacementStyle };

type NativeTextareaProps = ComponentProps<'textarea'>;

type TextareaProps = Omit<NativeTextareaProps, 'value' | 'defaultValue' | 'onChange' | 'readOnly'> &
  TextValueProperties<
    NonNullable<NativeTextareaProps['value']>,
    NonNullable<NativeTextareaProps['onChange']>,
    NonNullable<BaseInputProps['onValueChange']>
  > & { readonly xstyle?: PlacementStyle };

function FieldRoot({ className, style, xstyle, ...props }: FieldRootProps): ReactNode {
  return (
    <BaseField.Root
      {...props}
      {...mergeStyles<BaseField.Root.State>({ className, style, styles: stylex.props(styles.root, xstyle) })}
    />
  );
}

function FieldLabel({ className, style, ...props }: FieldLabelProps): ReactNode {
  return (
    <BaseField.Label
      {...props}
      {...mergeStyles<BaseField.Label.State>({ className, style, styles: stylex.props(styles.label) })}
    />
  );
}

function FieldDescription({ className, style, ...props }: FieldDescriptionProps): ReactNode {
  return (
    <BaseField.Description
      {...props}
      {...mergeStyles<BaseField.Description.State>({ className, style, styles: stylex.props(styles.description) })}
    />
  );
}

function FieldError({ className, style, ...props }: FieldErrorProps): ReactNode {
  return (
    <BaseField.Error
      {...props}
      {...mergeStyles<BaseField.Error.State>({ className, style, styles: stylex.props(styles.error) })}
    />
  );
}

export const Field = { Root: FieldRoot, Label: FieldLabel, Description: FieldDescription, Error: FieldError };

export function Input({ className, style, xstyle, ...props }: InputProps): ReactNode {
  return (
    <BaseInput
      {...props}
      {...mergeStyles<BaseInput.State>({ className, style, styles: stylex.props(styles.input, xstyle) })}
    />
  );
}

export function Textarea({
  value,
  defaultValue,
  onValueChange,
  name,
  disabled,
  readOnly,
  required,
  className,
  style,
  xstyle,
  ...props
}: TextareaProps): ReactNode {
  return (
    <BaseField.Control
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      render={<textarea {...props} />}
      {...mergeStyles<BaseField.Control.State>({
        className,
        style,
        styles: stylex.props(styles.input, styles.textarea, xstyle),
      })}
    />
  );
}
