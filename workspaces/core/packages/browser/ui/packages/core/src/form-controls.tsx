import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset';
import { Input as BaseInput } from '@base-ui/react/input';
import { mergeProps } from '@base-ui/react/merge-props';
import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import { Slider as BaseSlider } from '@base-ui/react/slider';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { ReadOnlyValueProperties, ValueStateProperties } from './control-state.ts';
import { fieldStyles } from './field-styles.ts';
import type { InputProps } from './forms.tsx';
import { mergeStyles } from './style-composition.ts';
import type { PlacementStyle } from './style-composition.ts';
import { colors, conditions, controls, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  fieldset: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
    minWidth: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
  },
  legend: {
    padding: 0,
    marginBlockEnd: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: 600,
    color: colors.ink,
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'stretch',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  embedded: { 'flex': 1, 'minWidth': 0, 'width': 0, 'borderWidth': 0, ':focus-visible': { outlineOffset: -2 } },
  addon: {
    display: 'inline-flex',
    flexShrink: 0,
    alignItems: 'center',
    paddingInline: controls.paddingInline,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  stepper: {
    'display': 'inline-flex',
    'flexShrink': 0,
    'alignItems': 'center',
    'justifyContent': 'center',
    'width': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'padding': 0,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'backgroundColor': 'transparent',
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontSize': typography.sectionSize,
    'cursor': 'pointer',
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'not-allowed' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  numberInput: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
  slider: {
    'display': 'flex',
    'flexDirection': 'column',
    'gap': spacing.sm,
    'minWidth': 0,
    'fontFamily': typography.fontFamily,
    'color': colors.ink,
    ':is([data-disabled])': { opacity: controls.disabledOpacity },
  },
  sliderControl: {
    'position': 'relative',
    'display': 'flex',
    'alignItems': 'center',
    'minWidth': 0,
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'touchAction': 'none',
    'userSelect': 'none',
    ':is([data-orientation="vertical"])': { width: controls.coarseTarget, minHeight: 160, justifyContent: 'center' },
  },
  track: {
    'position': 'relative',
    'width': '100%',
    'height': 3,
    'backgroundColor': colors.line,
    'borderRadius': radii.sm,
    ':is([data-orientation="vertical"])': { width: 3, height: '100%', minHeight: 160 },
  },
  range: {
    'position': 'absolute',
    'height': '100%',
    'borderRadius': radii.sm,
    'backgroundColor': colors.ink,
    ':is([data-orientation="vertical"])': { width: '100%', height: 'auto' },
  },
  thumb: {
    'display': 'block',
    'width': 16,
    'height': 16,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.ink,
    'borderRadius': radii.sm,
    'backgroundColor': colors.surface,
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
    '::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: controls.coarseTarget,
      height: controls.coarseTarget,
    },
  },
  value: {
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontVariantNumeric: 'tabular-nums',
    color: colors.muted,
  },
  file: {
    'padding': 0,
    'lineHeight': controls.mdHeight,
    '::file-selector-button': {
      marginInlineEnd: spacing.sm,
      paddingBlock: 0,
      paddingInline: controls.paddingInline,
      minHeight: { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
      borderWidth: 0,
      borderInlineEndWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      color: colors.ink,
      fontFamily: typography.fontFamily,
      fontSize: typography.bodySize,
      cursor: 'pointer',
    },
    ':disabled': { '::file-selector-button': { cursor: 'not-allowed', color: colors.muted } },
  },
});

type FieldsetRootProps = ComponentProps<typeof BaseFieldset.Root> & { readonly xstyle?: PlacementStyle };
type FieldsetLegendProps = ComponentProps<typeof BaseFieldset.Legend>;
type InputGroupRootProps = ComponentProps<'div'> & { readonly xstyle?: PlacementStyle };
type InputGroupAddonProps = ComponentProps<'span'>;

type NumberFieldRootProps = Omit<
  ComponentProps<typeof BaseNumberField.Root>,
  'value' | 'defaultValue' | 'onValueChange' | 'locale'
> &
  (
    | ValueStateProperties<number | null, NonNullable<BaseNumberField.Root.Props['onValueChange']>, number>
    | ReadOnlyValueProperties<number | null, NonNullable<BaseNumberField.Root.Props['onValueChange']>>
  ) & { readonly locale: string; readonly xstyle?: PlacementStyle };

type NumberFieldGroupProps = ComponentProps<typeof BaseNumberField.Group>;
type NumberFieldInputProps = ComponentProps<typeof BaseNumberField.Input>;
type NumberFieldIncrementProps = ComponentProps<typeof BaseNumberField.Increment>;
type NumberFieldDecrementProps = ComponentProps<typeof BaseNumberField.Decrement>;

type SliderRootProps<Value extends number | ReadonlyArray<number>> = Omit<
  BaseSlider.Root.Props<Value>,
  'value' | 'defaultValue' | 'onValueChange' | 'locale'
> &
  ValueStateProperties<Value, NonNullable<BaseSlider.Root.Props<Value>['onValueChange']>> & {
    readonly locale: string;
    readonly xstyle?: PlacementStyle;
  };

type SliderControlProps = ComponentProps<typeof BaseSlider.Control>;
type SliderTrackProps = ComponentProps<typeof BaseSlider.Track>;
type SliderIndicatorProps = ComponentProps<typeof BaseSlider.Indicator>;
type SliderThumbProps = ComponentProps<typeof BaseSlider.Thumb>;
type SliderLabelProps = ComponentProps<typeof BaseSlider.Label>;
type SliderValueProps = ComponentProps<typeof BaseSlider.Value>;

type FilePickerProps = Omit<ComponentProps<typeof BaseInput>, 'type' | 'value' | 'defaultValue' | 'onValueChange'> & {
  readonly xstyle?: PlacementStyle;
};

function FieldsetRoot({ className, style, xstyle, ...props }: FieldsetRootProps): ReactNode {
  return (
    <BaseFieldset.Root
      {...props}
      {...mergeStyles<BaseFieldset.Root.State>({ className, style, styles: stylex.props(styles.fieldset, xstyle) })}
    />
  );
}

function FieldsetLegend({ className, style, ...props }: FieldsetLegendProps): ReactNode {
  return (
    <BaseFieldset.Legend
      {...props}
      {...mergeStyles<BaseFieldset.Legend.State>({ className, style, styles: stylex.props(styles.legend) })}
    />
  );
}

function InputGroupRoot({ xstyle, ...props }: InputGroupRootProps): ReactNode {
  return <div {...mergeProps<'div'>(stylex.props(styles.inputGroup, xstyle), props)} />;
}

function InputGroupAddon(props: InputGroupAddonProps): ReactNode {
  return <span {...mergeProps<'span'>(stylex.props(styles.addon), props)} />;
}

function InputGroupInput({ className, style, xstyle, ...props }: InputProps): ReactNode {
  return (
    <BaseInput
      {...props}
      {...mergeStyles<BaseInput.State>({
        className,
        style,
        styles: stylex.props(fieldStyles.input, styles.embedded, xstyle),
      })}
    />
  );
}

function NumberFieldRoot({ className, style, xstyle, ...props }: NumberFieldRootProps): ReactNode {
  return (
    <BaseNumberField.Root
      {...props}
      {...mergeStyles<BaseNumberField.Root.State>({ className, style, styles: stylex.props(fieldStyles.root, xstyle) })}
    />
  );
}

function NumberFieldGroup({ className, style, ...props }: NumberFieldGroupProps): ReactNode {
  return (
    <BaseNumberField.Group
      {...props}
      {...mergeStyles<BaseNumberField.Group.State>({ className, style, styles: stylex.props(styles.inputGroup) })}
    />
  );
}

function NumberFieldInput({ className, style, ...props }: NumberFieldInputProps): ReactNode {
  return (
    <BaseNumberField.Input
      {...props}
      {...mergeStyles<BaseNumberField.Input.State>({
        className,
        style,
        styles: stylex.props(fieldStyles.input, styles.embedded, styles.numberInput),
      })}
    />
  );
}

function NumberFieldIncrement({
  children = '+',
  'aria-label': label = 'Increase',
  className,
  style,
  ...props
}: NumberFieldIncrementProps): ReactNode {
  return (
    <BaseNumberField.Increment
      {...props}
      aria-label={label}
      {...mergeStyles<BaseNumberField.Increment.State>({ className, style, styles: stylex.props(styles.stepper) })}
    >
      {children}
    </BaseNumberField.Increment>
  );
}

function NumberFieldDecrement({
  children = '−',
  'aria-label': label = 'Decrease',
  className,
  style,
  ...props
}: NumberFieldDecrementProps): ReactNode {
  return (
    <BaseNumberField.Decrement
      {...props}
      aria-label={label}
      {...mergeStyles<BaseNumberField.Decrement.State>({ className, style, styles: stylex.props(styles.stepper) })}
    >
      {children}
    </BaseNumberField.Decrement>
  );
}

function SliderRoot<Value extends number | ReadonlyArray<number>>({
  className,
  style,
  xstyle,
  ...props
}: SliderRootProps<Value>): ReactNode {
  return (
    <BaseSlider.Root<Value>
      {...props}
      {...mergeStyles<BaseSlider.Root.State>({ className, style, styles: stylex.props(styles.slider, xstyle) })}
    />
  );
}

function SliderControl({ className, style, ...props }: SliderControlProps): ReactNode {
  return (
    <BaseSlider.Control
      {...props}
      {...mergeStyles<BaseSlider.Control.State>({ className, style, styles: stylex.props(styles.sliderControl) })}
    />
  );
}

function SliderTrack({ className, style, ...props }: SliderTrackProps): ReactNode {
  return (
    <BaseSlider.Track
      {...props}
      {...mergeStyles<BaseSlider.Track.State>({ className, style, styles: stylex.props(styles.track) })}
    />
  );
}

function SliderIndicator({ className, style, ...props }: SliderIndicatorProps): ReactNode {
  return (
    <BaseSlider.Indicator
      {...props}
      {...mergeStyles<BaseSlider.Indicator.State>({ className, style, styles: stylex.props(styles.range) })}
    />
  );
}

function SliderThumb({ className, style, ...props }: SliderThumbProps): ReactNode {
  return (
    <BaseSlider.Thumb
      {...props}
      {...mergeStyles<BaseSlider.Thumb.State>({ className, style, styles: stylex.props(styles.thumb) })}
    />
  );
}

function SliderLabel({ className, style, ...props }: SliderLabelProps): ReactNode {
  return (
    <BaseSlider.Label
      {...props}
      {...mergeStyles<BaseSlider.Label.State>({ className, style, styles: stylex.props(fieldStyles.label) })}
    />
  );
}

function SliderValue({ className, style, ...props }: SliderValueProps): ReactNode {
  return (
    <BaseSlider.Value
      {...props}
      {...mergeStyles<BaseSlider.Value.State>({ className, style, styles: stylex.props(styles.value) })}
    />
  );
}

export function FilePicker({ className, style, xstyle, ...props }: FilePickerProps): ReactNode {
  return (
    <BaseInput
      {...props}
      type="file"
      {...mergeStyles<BaseInput.State>({
        className,
        style,
        styles: stylex.props(fieldStyles.input, styles.file, xstyle),
      })}
    />
  );
}

export const Fieldset = { Root: FieldsetRoot, Legend: FieldsetLegend };
export const InputGroup = { Root: InputGroupRoot, Addon: InputGroupAddon, Input: InputGroupInput };

export const NumberField = {
  Root: NumberFieldRoot,
  Group: NumberFieldGroup,
  Input: NumberFieldInput,
  Increment: NumberFieldIncrement,
  Decrement: NumberFieldDecrement,
};

export const Slider = {
  Root: SliderRoot,
  Label: SliderLabel,
  Value: SliderValue,
  Control: SliderControl,
  Track: SliderTrack,
  Indicator: SliderIndicator,
  Thumb: SliderThumb,
};
