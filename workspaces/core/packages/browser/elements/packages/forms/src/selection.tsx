import * as stylex from '@stylexjs/stylex';
import { Checkbox as SdkCheckbox, CheckboxIndicator as SdkCheckboxIndicator } from '@ui-sdk/react/checkbox';
import {
  Radio as SdkRadio,
  RadioGroup as SdkRadioGroup,
  RadioIndicator as SdkRadioIndicator,
} from '@ui-sdk/react/radio';
import { Switch as SdkSwitch, SwitchThumb as SdkSwitchThumb } from '@ui-sdk/react/switch';
import { Toggle as SdkToggle, ToggleGroup as SdkToggleGroup } from '@ui-sdk/react/toggle';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type {
  CheckedStateProperties,
  ReadOnlyValueProperties,
  ValueStateProperties,
} from '../../foundations/src/control-state.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const GROUP_OUTLINE_WIDTH_PX = 1;
const SWITCH_TRACK_WIDTH_PX = 36;
const SWITCH_TRACK_HEIGHT_PX = 20;
const SWITCH_THUMB_SIZE_PX = 14;
const SWITCH_THUMB_RADIUS_PX = 2;
const SWITCH_THUMB_INSET_PX = (SWITCH_TRACK_HEIGHT_PX - SWITCH_THUMB_SIZE_PX) / 2;
const SWITCH_CHECKED_OFFSET_PX = SWITCH_TRACK_WIDTH_PX - SWITCH_THUMB_SIZE_PX - SWITCH_THUMB_INSET_PX;

const styles = stylex.create({
  choice: {
    'position': 'relative',
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'flexShrink': 0,
    'boxSizing': 'border-box',
    'width': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'height': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'borderWidth': 0,
    'padding': 0,
    'backgroundColor': 'transparent',
    'color': colors.inverse,
    'verticalAlign': 'middle',
    'cursor': 'pointer',
    'outlineOffset': 2,
    ':focus-visible': { outlineWidth: controls.focusWidth, outlineStyle: 'solid', outlineColor: colors.focus },
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'not-allowed' },
    '::before': {
      position: 'absolute',
      content: '""',
      width: 16,
      height: 16,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.muted,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
    },
    ':is([data-checked], [data-indeterminate])': {
      '::before': { backgroundColor: colors.ink, borderColor: colors.ink },
    },
    ':is([data-invalid])': { '::before': { borderColor: colors.danger } },
    ':hover:not(:active, [data-disabled], [data-checked], [data-indeterminate])': {
      '::before': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    },
    ':active:not([data-disabled], [data-checked], [data-indeterminate])': {
      '::before': { backgroundColor: colors.line },
    },
    ':hover:is([data-checked], [data-indeterminate]):not([data-disabled])': {
      '::before': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } },
    },
    ':active:is([data-checked], [data-indeterminate]):not([data-disabled])': {
      '::before': { backgroundColor: colors.inkHover },
    },
  },
  indicator: {
    'position': 'relative',
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    ':is([data-unchecked])': { visibility: 'hidden' },
  },
  checkGlyph: {
    '::before': {
      content: '""',
      display: 'block',
      width: 4,
      height: 8,
      borderWidth: 0,
      borderInlineEndWidth: 2,
      borderBottomWidth: 2,
      borderStyle: 'solid',
      borderColor: 'currentColor',
      transform: 'translateY(-1px) rotate(45deg)',
    },
    ':is([data-indeterminate])': { '::before': { width: 8, height: 0, borderInlineEndWidth: 0, transform: 'none' } },
  },
  radio: { 'borderRadius': '50%', '::before': { borderRadius: '50%' } },
  radioIndicator: { width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.inverse },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  switch: {
    'position': 'relative',
    'display': 'inline-flex',
    'alignItems': 'center',
    'flexShrink': 0,
    'width': controls.coarseTarget,
    'height': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'padding': 0,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'backgroundColor': 'transparent',
    'cursor': 'pointer',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'not-allowed' },
    '::before': {
      content: '""',
      position: 'absolute',
      insetInlineStart: 0,
      width: SWITCH_TRACK_WIDTH_PX,
      height: SWITCH_TRACK_HEIGHT_PX,
      borderRadius: radii.sm,
      backgroundColor: colors.muted,
    },
    ':is([data-checked])': { '::before': { backgroundColor: colors.ink } },
    ':hover:not([data-disabled])': { '::before': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } } },
    ':active:not([data-disabled])': { '::before': { backgroundColor: colors.inkHover } },
  },
  thumb: {
    'position': 'relative',
    'width': SWITCH_THUMB_SIZE_PX,
    'height': SWITCH_THUMB_SIZE_PX,
    'marginInlineStart': SWITCH_THUMB_INSET_PX,
    'borderRadius': SWITCH_THUMB_RADIUS_PX,
    'backgroundColor': colors.surface,
    ':is([data-checked])': { marginInlineStart: SWITCH_CHECKED_OFFSET_PX },
  },
  toggles: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'flexWrap': 'wrap',
    'minWidth': 0,
    'maxWidth': '100%',
    'boxSizing': 'border-box',
    'gap': 0,
    'padding': 0,
    'outlineWidth': GROUP_OUTLINE_WIDTH_PX,
    'outlineOffset': -GROUP_OUTLINE_WIDTH_PX,
    'outlineStyle': 'solid',
    'outlineColor': colors.line,
    'borderRadius': radii.sm,
    'backgroundColor': colors.surface,
    ':is([data-orientation="vertical"])': { flexDirection: 'column', alignItems: 'stretch' },
  },
  toggle: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'gap': spacing.xs,
    'minWidth': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'minHeight': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'maxWidth': '100%',
    'paddingBlock': 0,
    'paddingInline': controls.paddingInline,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'overflowWrap': 'anywhere',
    'color': colors.muted,
    'backgroundColor': 'transparent',
    'cursor': 'pointer',
    ':is([data-pressed])': { backgroundColor: colors.canvas, color: colors.ink },
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
});

type CheckboxChange = NonNullable<ComponentProps<typeof SdkCheckbox>['onCheckedChange']>;
type RadioChange<Value extends string> = NonNullable<ComponentProps<typeof SdkRadioGroup<Value>>['onValueChange']>;
type RadioSelection<Value extends string> = (value: Value, details: Parameters<RadioChange<Value>>[1]) => void;

type CheckboxRootProps = Omit<
  ComponentProps<typeof SdkCheckbox>,
  'checked' | 'defaultChecked' | 'onCheckedChange' | 'readOnly'
> &
  CheckedStateProperties<(isChecked: boolean, details: Parameters<CheckboxChange>[1]) => void> & {
    readonly indeterminate?: boolean;
    readonly xstyle?: PlacementStyle;
  };

type CheckboxIndicatorProps = ComponentProps<typeof SdkCheckboxIndicator>;

type RadioGroupRootProps<Value extends string> = Omit<
  ComponentProps<typeof SdkRadioGroup<Value>>,
  'value' | 'defaultValue' | 'onValueChange'
> &
  (ValueStateProperties<Value, RadioSelection<Value>> | ReadOnlyValueProperties<Value, RadioSelection<Value>>) & {
    readonly xstyle?: PlacementStyle;
  };

type RadioItemProps = ComponentProps<typeof SdkRadio> & { readonly xstyle?: PlacementStyle };
type RadioIndicatorProps = ComponentProps<typeof SdkRadioIndicator>;

type SwitchRootProps = Omit<
  ComponentProps<typeof SdkSwitch>,
  'checked' | 'defaultChecked' | 'onCheckedChange' | 'readOnly'
> &
  CheckedStateProperties<NonNullable<ComponentProps<typeof SdkSwitch>['onCheckedChange']>> & {
    readonly xstyle?: PlacementStyle;
  };

type SwitchThumbProps = ComponentProps<typeof SdkSwitchThumb>;

type ToggleGroupRootProps<Value extends string> = Omit<
  ComponentProps<typeof SdkToggleGroup<Value>>,
  'value' | 'defaultValue' | 'onValueChange'
> &
  ValueStateProperties<
    ReadonlyArray<Value>,
    NonNullable<ComponentProps<typeof SdkToggleGroup<Value>>['onValueChange']>
  > & { readonly xstyle?: PlacementStyle };

type ToggleItemProps<Value extends string> = Omit<
  ComponentProps<typeof SdkToggle>,
  'value' | 'pressed' | 'defaultPressed' | 'onPressedChange'
> & { readonly value: Value };

function CheckboxRoot({
  className,
  style,
  xstyle,
  indeterminate = false,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: CheckboxRootProps): ReactNode {
  const checkedState = indeterminate ? 'indeterminate' : checked;

  return (
    <SdkCheckbox
      {...props}
      {...(checkedState !== undefined && { checked: checkedState })}
      {...(checkedState === undefined && defaultChecked !== undefined && { defaultChecked })}
      onCheckedChange={(value, details) => onCheckedChange?.(value === true, details)}
      {...mergeStyles({ className, style, styles: stylex.props(styles.choice, xstyle) })}
    />
  );
}

function CheckboxIndicator({ children, className, style, ...props }: CheckboxIndicatorProps): ReactNode {
  return (
    <SdkCheckboxIndicator
      {...props}
      {...mergeStyles({
        className,
        style,
        styles: stylex.props(styles.indicator, children === undefined && styles.checkGlyph),
      })}
    >
      {children}
    </SdkCheckboxIndicator>
  );
}

function RadioGroupRoot<Value extends string>({
  className,
  style,
  xstyle,
  onValueChange,
  ...props
}: RadioGroupRootProps<Value>): ReactNode {
  return (
    <SdkRadioGroup<Value>
      {...props}
      onValueChange={(value, details) => {
        if (value !== null) {
          onValueChange?.(value, details);
        }
      }}
      {...mergeStyles({ className, style, styles: stylex.props(styles.group, xstyle) })}
    />
  );
}

function RadioItem({ className, style, xstyle, ...props }: RadioItemProps): ReactNode {
  return (
    <SdkRadio
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.choice, styles.radio, xstyle) })}
    />
  );
}

function RadioIndicator({ className, style, ...props }: RadioIndicatorProps): ReactNode {
  return (
    <SdkRadioIndicator
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.indicator, styles.radioIndicator) })}
    />
  );
}

function SwitchRoot({ className, style, xstyle, ...props }: SwitchRootProps): ReactNode {
  return <SdkSwitch {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.switch, xstyle) })} />;
}

function SwitchThumb({ className, style, ...props }: SwitchThumbProps): ReactNode {
  return <SdkSwitchThumb {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.thumb) })} />;
}

function ToggleGroupRoot<Value extends string>({
  className,
  style,
  xstyle,
  value,
  defaultValue,
  ...props
}: ToggleGroupRootProps<Value>): ReactNode {
  return (
    <SdkToggleGroup<Value>
      {...props}
      {...(value !== undefined && { value: [...value] })}
      {...(defaultValue !== undefined && { defaultValue: [...defaultValue] })}
      {...mergeStyles({ className, style, styles: stylex.props(styles.toggles, xstyle) })}
    />
  );
}

function ToggleItem<Value extends string>({ className, style, ...props }: ToggleItemProps<Value>): ReactNode {
  return <SdkToggle {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.toggle) })} />;
}

export const Checkbox = { Root: CheckboxRoot, Indicator: CheckboxIndicator };
export const RadioGroup = { Root: RadioGroupRoot, Item: RadioItem, Indicator: RadioIndicator };
export const Switch = { Root: SwitchRoot, Thumb: SwitchThumb };
export const ToggleGroup = { Root: ToggleGroupRoot, Item: ToggleItem };
