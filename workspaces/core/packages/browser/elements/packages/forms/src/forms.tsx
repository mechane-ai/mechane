import * as stylex from '@stylexjs/stylex';
import {
  Field as SdkField,
  FieldControl as SdkFieldControl,
  FieldDescription as SdkFieldDescription,
  FieldError as SdkFieldError,
  FieldLabel as SdkFieldLabel,
} from '@ui-sdk/react/field';
import { Input as SdkInput } from '@ui-sdk/react/input';
import { Textarea as SdkTextarea } from '@ui-sdk/react/textarea';
import type { ComponentProps, ReactNode } from 'react';
import type { ControlDensity } from '../../foundations/src/control-density.ts';
import type { TextValueProperties } from '../../foundations/src/control-state.ts';
import {
  controlDensityStyles,
  controlStyles,
  singleLineControlDensityStyles,
} from '../../foundations/src/control-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { fieldStyles as styles, textareaAppearanceStyles } from './field-styles.ts';
import type { TextareaAppearance } from './field-styles.ts';

type FieldRootProps = ComponentProps<typeof SdkField> & {
  /** Hide this whole field, including its label, description and validation messages, from the agent. */
  readonly isSensitive?: boolean;
  readonly xstyle?: PlacementStyle;
};

type FieldLabelProps = ComponentProps<typeof SdkFieldLabel>;
type FieldDescriptionProps = ComponentProps<typeof SdkFieldDescription>;
type FieldErrorProps = ComponentProps<typeof SdkFieldError>;

type TextControlProps<Tag extends 'input' | 'textarea'> = Omit<
  ComponentProps<Tag>,
  'value' | 'defaultValue' | 'onChange' | 'readOnly' | 'size' | 'onSelect' | 'onSubmit'
> &
  TextValueProperties<string | number, NonNullable<ComponentProps<Tag>['onChange']>, (value: string) => void> & {
    /** Keep credentials and other private text out of the UI SDK runtime. Password inputs always use this mode. */
    readonly isSensitive?: boolean;
    readonly xstyle?: PlacementStyle;
  };

export type InputProps = TextControlProps<'input'> & { readonly density?: ControlDensity };

type TextareaProps = TextControlProps<'textarea'> & {
  readonly isCompact?: boolean;
  readonly shouldGrow?: boolean;
  readonly appearance?: TextareaAppearance;
};

function FieldRoot({ className, style, xstyle, isSensitive = false, ...props }: FieldRootProps): ReactNode {
  return (
    <SdkField
      {...props}
      {...(isSensitive && { 'data-agent-hidden': '', 'data-agent-secret': '' })}
      {...mergeStyles({ className, style, styles: stylex.props(controlStyles.fieldRoot, xstyle) })}
    />
  );
}

function FieldLabel({ className, style, ...props }: FieldLabelProps): ReactNode {
  return <SdkFieldLabel {...props} {...mergeStyles({ className, style, styles: stylex.props(controlStyles.label) })} />;
}

function FieldDescription({ className, style, ...props }: FieldDescriptionProps): ReactNode {
  return (
    <SdkFieldDescription
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(controlStyles.description) })}
    />
  );
}

function FieldError({ className, style, ...props }: FieldErrorProps): ReactNode {
  return <SdkFieldError {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.error) })} />;
}

export const Field = { Root: FieldRoot, Label: FieldLabel, Description: FieldDescription, Error: FieldError };

export function Input(props: InputProps): ReactNode {
  return <TextInput {...props} />;
}

function privateAutocomplete(autoComplete: string | undefined): boolean {
  return /(?:^|\s)(?:current-password|new-password|one-time-code|cc-[a-z-]+)(?:\s|$)/i.test(autoComplete ?? '');
}

export function TextInput({
  density = 'standard',
  isEmbedded = false,
  isSensitive = false,
  className,
  style,
  xstyle,
  value,
  defaultValue,
  onValueChange,
  onChange,
  ...props
}: InputProps & { readonly isEmbedded?: boolean }): ReactNode {
  const styled = mergeStyles({
    className,
    style,
    styles: stylex.props(
      controlStyles.base,
      controlStyles.field,
      controlStyles.singleLineField,
      controlStyles.textFieldState,
      controlDensityStyles[density],
      singleLineControlDensityStyles[density],
      isEmbedded && controlStyles.embedded,
      xstyle,
    ),
  });

  if (isSensitive || props.type?.toLowerCase() === 'password' || privateAutocomplete(props.autoComplete)) {
    return (
      <SdkFieldControl
        {...props}
        {...styled}
        data-agent-hidden=""
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          onChange?.(event);

          if (!event.defaultPrevented) {
            onValueChange?.(event.currentTarget.value);
          }
        }}
      />
    );
  }

  return (
    <SdkInput
      {...props}
      {...styled}
      {...(value !== undefined && { value: String(value) })}
      {...(defaultValue !== undefined && { defaultValue: String(defaultValue) })}
      {...(onChange !== undefined && { onChange })}
      {...(onValueChange !== undefined && { onValueChange })}
    />
  );
}

export function Textarea({
  isCompact = false,
  shouldGrow = false,
  appearance = 'field',
  isSensitive = false,
  className,
  style,
  xstyle,
  value,
  defaultValue,
  onValueChange,
  onChange,
  ...props
}: TextareaProps): ReactNode {
  const styled = mergeStyles({
    className,
    style,
    styles: stylex.props(
      controlStyles.base,
      controlStyles.field,
      controlStyles.textFieldState,
      controlStyles.textarea,
      isCompact && styles.compactTextarea,
      shouldGrow && styles.growingTextarea,
      textareaAppearanceStyles[appearance],
      xstyle,
    ),
  });

  if (isSensitive || privateAutocomplete(props.autoComplete)) {
    return (
      <SdkFieldControl
        {...(props.id !== undefined && { id: props.id })}
        {...(props.name !== undefined && { name: props.name })}
        render={
          <textarea
            {...props}
            data-agent-hidden=""
            className={styled.className({})}
            style={styled.style({})}
            value={value}
            defaultValue={defaultValue}
            onChange={(event) => {
              onChange?.(event);

              if (!event.defaultPrevented) {
                onValueChange?.(event.currentTarget.value);
              }
            }}
          />
        }
      />
    );
  }

  return (
    <SdkTextarea
      {...props}
      {...styled}
      {...(value !== undefined && { value: String(value) })}
      {...(defaultValue !== undefined && { defaultValue: String(defaultValue) })}
      {...(onChange !== undefined && { onChange })}
      {...(onValueChange !== undefined && { onValueChange })}
    />
  );
}
