import { Field as BaseField } from '@base-ui/react/field';
import { Input as BaseInput } from '@base-ui/react/input';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { TextValueProperties } from '../../foundations/src/control-state.ts';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { fieldStyles as styles, textareaAppearanceStyles } from './field-styles.ts';
import type { TextareaAppearance } from './field-styles.ts';

type FieldRootProps = ComponentProps<typeof BaseField.Root> & { readonly xstyle?: PlacementStyle };
type FieldLabelProps = ComponentProps<typeof BaseField.Label>;
type FieldDescriptionProps = ComponentProps<typeof BaseField.Description>;
type FieldErrorProps = ComponentProps<typeof BaseField.Error>;
type BaseInputProps = ComponentProps<typeof BaseInput>;

export type InputProps = Omit<
  BaseInputProps,
  'value' | 'defaultValue' | 'onChange' | 'onValueChange' | 'readOnly' | 'size'
> &
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
  > & {
    readonly xstyle?: PlacementStyle;
    readonly isCompact?: boolean;
    readonly shouldGrow?: boolean;
    readonly appearance?: TextareaAppearance;
  };

function FieldRoot({ className, style, xstyle, ...props }: FieldRootProps): ReactNode {
  return (
    <BaseField.Root
      {...props}
      {...mergeStyles<BaseField.Root.State>({
        className,
        style,
        styles: stylex.props(controlStyles.fieldRoot, xstyle),
      })}
    />
  );
}

function FieldLabel({ className, style, ...props }: FieldLabelProps): ReactNode {
  return (
    <BaseField.Label
      {...props}
      {...mergeStyles<BaseField.Label.State>({ className, style, styles: stylex.props(controlStyles.label) })}
    />
  );
}

function FieldDescription({ className, style, ...props }: FieldDescriptionProps): ReactNode {
  return (
    <BaseField.Description
      {...props}
      {...mergeStyles<BaseField.Description.State>({
        className,
        style,
        styles: stylex.props(controlStyles.description),
      })}
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
      {...mergeStyles<BaseInput.State>({
        className,
        style,
        styles: stylex.props(controlStyles.base, controlStyles.field, styles.input, xstyle),
      })}
    />
  );
}

export function Textarea({
  isCompact = false,
  shouldGrow = false,
  appearance = 'field',
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
        styles: stylex.props(
          controlStyles.base,
          controlStyles.field,
          styles.input,
          controlStyles.textarea,
          isCompact && styles.compactTextarea,
          shouldGrow && styles.growingTextarea,
          textareaAppearanceStyles[appearance],
          xstyle,
        ),
      })}
    />
  );
}
