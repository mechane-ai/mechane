import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import {
  Field as SdkField,
  FieldControl as SdkFieldControl,
  FieldLabel as SdkFieldLabel,
  FieldLegend as SdkFieldLegend,
  FieldSet as SdkFieldSet,
  useFieldControl,
} from '@ui-sdk/react/field';
import { InputGroup as SdkInputGroup } from '@ui-sdk/react/input';
import {
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInput as SdkNumberInput,
} from '@ui-sdk/react/number-input';
import {
  Slider as SdkSlider,
  SliderControl as SdkSliderControl,
  SliderIndicator as SdkSliderIndicator,
  SliderThumb as SdkSliderThumb,
  SliderTrack as SdkSliderTrack,
  SliderValue as SdkSliderValue,
} from '@ui-sdk/react/slider';
import { createContext, useContext } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type { ControlDensity } from '../../foundations/src/control-density.ts';
import type { ReadOnlyValueProperties, ValueStateProperties } from '../../foundations/src/control-state.ts';
import {
  actionTargetDensityStyles,
  controlDensityStyles,
  controlStyles,
  controlTargetDensityStyles,
  singleLineControlDensityStyles,
} from '../../foundations/src/control-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { TextInput } from './forms.tsx';
import type { InputProps } from './forms.tsx';

const InputGroupDensityContext = createContext<ControlDensity>('standard');
const NumberFieldDensityContext = createContext<ControlDensity>('standard');

const styles = stylex.create({
  fieldContext: { display: 'contents' },
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
    fontWeight: typography.strongWeight,
    color: colors.ink,
    overflowWrap: 'anywhere',
  },
  addon: {
    display: 'inline-flex',
    flexShrink: 0,
    alignItems: 'center',
    paddingInline: controls.paddingInline,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  stepper: {
    'display': 'inline-flex',
    'flexShrink': 0,
    'alignItems': 'center',
    'justifyContent': 'center',
    'boxSizing': 'border-box',
    'padding': 0,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'backgroundColor': 'transparent',
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.sectionSize,
    'lineHeight': typography.sectionLineHeight,
    'cursor': 'pointer',
    ':hover:not(:active, [data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not([data-disabled])': { backgroundColor: colors.line },
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
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'color': colors.ink,
    ':is([data-disabled])': { opacity: controls.disabledOpacity },
  },
  sliderControl: {
    'position': 'relative',
    'display': 'flex',
    'alignItems': 'center',
    'minWidth': 0,
    'minHeight': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
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
    'boxSizing': 'border-box',
    'width': 16,
    'height': 16,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.ink,
    'borderRadius': radii.sm,
    'backgroundColor': colors.surface,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':is([data-dragging]):not([data-disabled])': { backgroundColor: colors.canvas },
    ':has(:focus-visible)': {
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
    'paddingBlock': 0,
    'paddingInline': 0,
    'lineHeight': {
      default: `calc(${controls.height} - 2px)`,
      [conditions.coarsePointer]: `calc(${controls.coarseTarget} - 2px)`,
    },
    '::file-selector-button': {
      marginInlineEnd: spacing.sm,
      paddingBlock: 0,
      paddingInline: controls.paddingInline,
      minHeight: {
        default: `calc(${controls.height} - 2px)`,
        [conditions.coarsePointer]: `calc(${controls.coarseTarget} - 2px)`,
      },
      borderWidth: 0,
      borderInlineEndWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      color: colors.ink,
      fontFamily: typography.fontFamily,
      fontWeight: typography.regularWeight,
      fontSize: { default: typography.bodySize, [conditions.coarsePointer]: typography.touchInputSize },
      cursor: 'pointer',
    },
    ':hover:not(:disabled)': {
      '::file-selector-button': { backgroundColor: { [conditions.hoverPointer]: colors.line } },
    },
    ':active:not(:disabled)': { '::file-selector-button': { backgroundColor: colors.line } },
    ':disabled': { '::file-selector-button': { cursor: 'not-allowed', color: colors.muted } },
  },
});

const addonDensityStyles = stylex.create<Record<ControlDensity, stylex.CSSProperties>>({
  standard: {},
  compact: { paddingInline: controls.compactPaddingInline },
});

const fileStyles = stylex.create({
  standard: {},
  compact: {
    'lineHeight': {
      default: `calc(${controls.compactHeight} - 2px)`,
      [conditions.coarsePointer]: `calc(${controls.coarseTarget} - 2px)`,
    },
    '::file-selector-button': {
      paddingInline: controls.compactPaddingInline,
      minHeight: {
        default: `calc(${controls.compactHeight} - 2px)`,
        [conditions.coarsePointer]: `calc(${controls.coarseTarget} - 2px)`,
      },
    },
  },
});

const fileDensityStyles = { standard: fileStyles.standard, compact: fileStyles.compact } satisfies Record<
  ControlDensity,
  stylex.CompiledStyles
>;

type FieldsetRootProps = ComponentProps<typeof SdkFieldSet> & { readonly xstyle?: PlacementStyle };
type FieldsetLegendProps = ComponentProps<typeof SdkFieldLegend>;

type InputGroupRootProps = ComponentProps<typeof SdkInputGroup> & {
  readonly density?: ControlDensity;
  readonly xstyle?: PlacementStyle;
};

type InputGroupAddonProps = ComponentProps<'span'>;
type InputGroupInputProps = InputProps & { readonly density?: never };

type NumberFieldRootProps = Omit<
  ComponentProps<typeof SdkNumberInput>,
  'value' | 'defaultValue' | 'onValueChange' | 'locale'
> &
  (
    | ValueStateProperties<number | null, NonNullable<ComponentProps<typeof SdkNumberInput>['onValueChange']>, number>
    | ReadOnlyValueProperties<number | null, NonNullable<ComponentProps<typeof SdkNumberInput>['onValueChange']>>
  ) & { readonly locale: string; readonly density?: ControlDensity; readonly xstyle?: PlacementStyle };

type NumberFieldGroupProps = ComponentProps<typeof NumberInputGroup>;
type NumberFieldInputProps = ComponentProps<typeof NumberInputControl>;
type NumberFieldIncrementProps = ComponentProps<typeof NumberInputIncrement>;
type NumberFieldDecrementProps = ComponentProps<typeof NumberInputDecrement>;

type SliderRootProps<Value extends number | Array<number>> = Omit<
  ComponentProps<typeof SdkSlider<Value>>,
  'value' | 'defaultValue' | 'onValueChange' | 'locale'
> &
  ValueStateProperties<Value, NonNullable<ComponentProps<typeof SdkSlider<Value>>['onValueChange']>> & {
    readonly locale: string;
    readonly xstyle?: PlacementStyle;
  };

type SliderControlProps = ComponentProps<typeof SdkSliderControl>;
type SliderTrackProps = ComponentProps<typeof SdkSliderTrack>;
type SliderIndicatorProps = ComponentProps<typeof SdkSliderIndicator>;
type SliderThumbProps = ComponentProps<typeof SdkSliderThumb>;
type SliderLabelProps = ComponentProps<typeof SdkFieldLabel>;
type SliderValueProps = ComponentProps<typeof SdkSliderValue>;

type FilePickerProps = Omit<
  ComponentProps<typeof SdkFieldControl>,
  'type' | 'value' | 'defaultValue' | 'onValueChange'
> & { readonly density?: ControlDensity; readonly xstyle?: PlacementStyle };

function FieldsetRoot({ className, style, xstyle, ...props }: FieldsetRootProps): ReactNode {
  return (
    <SdkFieldSet {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.fieldset, xstyle) })} />
  );
}

function FieldsetLegend({ className, style, ...props }: FieldsetLegendProps): ReactNode {
  return <SdkFieldLegend {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.legend) })} />;
}

function InputGroupRoot({ density = 'standard', className, style, xstyle, ...props }: InputGroupRootProps): ReactNode {
  return (
    <InputGroupDensityContext value={density}>
      <SdkInputGroup
        {...props}
        {...mergeStyles({
          className,
          style,
          styles: stylex.props(controlStyles.group, controlTargetDensityStyles[density], xstyle),
        })}
      />
    </InputGroupDensityContext>
  );
}

function InputGroupAddon(props: InputGroupAddonProps): ReactNode {
  const density = useContext(InputGroupDensityContext);

  return <span {...mergeProps<'span'>(stylex.props(styles.addon, addonDensityStyles[density]), props)} />;
}

function InputGroupInput(props: InputGroupInputProps): ReactNode {
  const density = useContext(InputGroupDensityContext);

  return <TextInput {...props} density={density} isEmbedded />;
}

function NumberFieldRoot({
  density = 'standard',
  className,
  style,
  xstyle,
  ...props
}: NumberFieldRootProps): ReactNode {
  return (
    <NumberFieldDensityContext value={density}>
      <SdkNumberInput
        {...props}
        {...mergeStyles({ className, style, styles: stylex.props(controlStyles.fieldRoot, xstyle) })}
      />
    </NumberFieldDensityContext>
  );
}

function NumberFieldGroup({ className, style, ...props }: NumberFieldGroupProps): ReactNode {
  const density = useContext(NumberFieldDensityContext);

  return (
    <NumberInputGroup
      {...props}
      {...mergeStyles({
        className,
        style,
        styles: stylex.props(controlStyles.group, controlTargetDensityStyles[density]),
      })}
    />
  );
}

function NumberFieldInput({ className, style, ...props }: NumberFieldInputProps): ReactNode {
  const density = useContext(NumberFieldDensityContext);

  return (
    <NumberInputControl
      {...props}
      {...mergeStyles({
        className,
        style,
        styles: stylex.props(
          controlStyles.base,
          controlStyles.field,
          controlStyles.singleLineField,
          controlStyles.textFieldState,
          controlDensityStyles[density],
          singleLineControlDensityStyles[density],
          controlStyles.embedded,
          styles.numberInput,
        ),
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
  const density = useContext(NumberFieldDensityContext);

  return (
    <NumberInputIncrement
      {...props}
      aria-label={label}
      {...mergeStyles({ className, style, styles: stylex.props(actionTargetDensityStyles[density], styles.stepper) })}
    >
      {children}
    </NumberInputIncrement>
  );
}

function NumberFieldDecrement({
  children = '−',
  'aria-label': label = 'Decrease',
  className,
  style,
  ...props
}: NumberFieldDecrementProps): ReactNode {
  const density = useContext(NumberFieldDensityContext);

  return (
    <NumberInputDecrement
      {...props}
      aria-label={label}
      {...mergeStyles({ className, style, styles: stylex.props(actionTargetDensityStyles[density], styles.stepper) })}
    >
      {children}
    </NumberInputDecrement>
  );
}

function SliderRoot<Value extends number | Array<number>>({
  className,
  style,
  xstyle,
  ...props
}: SliderRootProps<Value>): ReactNode {
  const field = useFieldControl();

  const slider = (
    <SdkSlider<Value> {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.slider, xstyle) })} />
  );

  return field === null ? <SdkField {...stylex.props(styles.fieldContext)}>{slider}</SdkField> : slider;
}

function SliderControl({ className, style, ...props }: SliderControlProps): ReactNode {
  return (
    <SdkSliderControl {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.sliderControl) })} />
  );
}

function SliderTrack({ className, style, ...props }: SliderTrackProps): ReactNode {
  return <SdkSliderTrack {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.track) })} />;
}

function SliderIndicator({ className, style, ...props }: SliderIndicatorProps): ReactNode {
  return <SdkSliderIndicator {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.range) })} />;
}

function SliderThumb({ className, style, ...props }: SliderThumbProps): ReactNode {
  return <SdkSliderThumb {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.thumb) })} />;
}

function SliderLabel({ className, style, ...props }: SliderLabelProps): ReactNode {
  return <SdkFieldLabel {...props} {...mergeStyles({ className, style, styles: stylex.props(controlStyles.label) })} />;
}

function SliderValue({ className, style, ...props }: SliderValueProps): ReactNode {
  return <SdkSliderValue {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.value) })} />;
}

export function FilePicker({ density = 'standard', className, style, xstyle, ...props }: FilePickerProps): ReactNode {
  return (
    <SdkFieldControl
      {...props}
      type="file"
      {...mergeStyles({
        className,
        style,
        styles: stylex.props(
          controlStyles.base,
          controlStyles.field,
          controlStyles.singleLineField,
          controlStyles.textFieldState,
          controlDensityStyles[density],
          singleLineControlDensityStyles[density],
          styles.file,
          fileDensityStyles[density],
          xstyle,
        ),
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
