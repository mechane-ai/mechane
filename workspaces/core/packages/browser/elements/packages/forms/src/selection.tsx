import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { Toggle as BaseToggle } from '@base-ui/react/toggle';
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type {
  CheckedStateProperties,
  ReadOnlyValueProperties,
  ValueStateProperties,
} from '../../foundations/src/control-state.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, conditions, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  choice: {
    'position': 'relative',
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'flexShrink': 0,
    'boxSizing': 'border-box',
    'width': { default: 20, [conditions.coarsePointer]: controls.coarseTarget },
    'height': { default: 20, [conditions.coarsePointer]: controls.coarseTarget },
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
      width: 36,
      height: 20,
      borderRadius: radii.sm,
      backgroundColor: colors.muted,
    },
    ':is([data-checked])': { '::before': { backgroundColor: colors.ink } },
    ':hover:not([data-disabled])': { '::before': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } } },
    ':active:not([data-disabled])': { '::before': { backgroundColor: colors.inkHover } },
  },
  thumb: {
    'position': 'relative',
    'width': 14,
    'height': 14,
    'marginInlineStart': 3,
    'borderRadius': 2,
    'backgroundColor': colors.surface,
    ':is([data-checked])': { marginInlineStart: 19 },
  },
  toggles: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'flexWrap': 'wrap',
    'minWidth': 0,
    'maxWidth': '100%',
    'boxSizing': 'border-box',
    'gap': spacing.xxs,
    'padding': spacing.xxs,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
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

type CheckboxRootProps = Omit<
  ComponentProps<typeof BaseCheckbox.Root>,
  'checked' | 'defaultChecked' | 'onCheckedChange' | 'readOnly'
> &
  CheckedStateProperties<NonNullable<BaseCheckbox.Root.Props['onCheckedChange']>> & {
    readonly xstyle?: PlacementStyle;
  };

type CheckboxIndicatorProps = ComponentProps<typeof BaseCheckbox.Indicator>;

type RadioGroupRootProps<Value> = Omit<BaseRadioGroup.Props<Value>, 'value' | 'defaultValue' | 'onValueChange'> &
  (
    | ValueStateProperties<Value, NonNullable<BaseRadioGroup.Props<Value>['onValueChange']>>
    | ReadOnlyValueProperties<Value, NonNullable<BaseRadioGroup.Props<Value>['onValueChange']>>
  ) & { readonly xstyle?: PlacementStyle };

type RadioItemProps<Value> = BaseRadio.Root.Props<Value> & { readonly xstyle?: PlacementStyle };
type RadioIndicatorProps = ComponentProps<typeof BaseRadio.Indicator>;

type SwitchRootProps = Omit<
  ComponentProps<typeof BaseSwitch.Root>,
  'checked' | 'defaultChecked' | 'onCheckedChange' | 'readOnly'
> &
  CheckedStateProperties<NonNullable<BaseSwitch.Root.Props['onCheckedChange']>> & { readonly xstyle?: PlacementStyle };

type SwitchThumbProps = ComponentProps<typeof BaseSwitch.Thumb>;

type ToggleGroupRootProps<Value extends string> = Omit<
  BaseToggleGroup.Props<Value>,
  'value' | 'defaultValue' | 'onValueChange'
> &
  ValueStateProperties<ReadonlyArray<Value>, NonNullable<BaseToggleGroup.Props<Value>['onValueChange']>> & {
    readonly xstyle?: PlacementStyle;
  };

type ToggleItemProps<Value extends string> = Omit<
  BaseToggle.Props<Value>,
  'value' | 'pressed' | 'defaultPressed' | 'onPressedChange'
> & { readonly value: Value };

function CheckboxRoot({ className, style, xstyle, ...props }: CheckboxRootProps): ReactNode {
  return (
    <BaseCheckbox.Root
      {...props}
      {...mergeStyles<BaseCheckbox.Root.State>({ className, style, styles: stylex.props(styles.choice, xstyle) })}
    />
  );
}

function CheckboxIndicator({ children, className, style, ...props }: CheckboxIndicatorProps): ReactNode {
  return (
    <BaseCheckbox.Indicator
      {...props}
      {...mergeStyles<BaseCheckbox.Indicator.State>({
        className,
        style,
        styles: stylex.props(styles.indicator, children === undefined && styles.checkGlyph),
      })}
    >
      {children}
    </BaseCheckbox.Indicator>
  );
}

function RadioGroupRoot<Value>({ className, style, xstyle, ...props }: RadioGroupRootProps<Value>): ReactNode {
  return (
    <BaseRadioGroup<Value>
      {...props}
      {...mergeStyles<BaseRadioGroup.State>({ className, style, styles: stylex.props(styles.group, xstyle) })}
    />
  );
}

function RadioItem<Value>({ className, style, xstyle, ...props }: RadioItemProps<Value>): ReactNode {
  return (
    <BaseRadio.Root<Value>
      {...props}
      {...mergeStyles<BaseRadio.Root.State>({
        className,
        style,
        styles: stylex.props(styles.choice, styles.radio, xstyle),
      })}
    />
  );
}

function RadioIndicator({ className, style, ...props }: RadioIndicatorProps): ReactNode {
  return (
    <BaseRadio.Indicator
      {...props}
      {...mergeStyles<BaseRadio.Indicator.State>({
        className,
        style,
        styles: stylex.props(styles.indicator, styles.radioIndicator),
      })}
    />
  );
}

function SwitchRoot({ className, style, xstyle, ...props }: SwitchRootProps): ReactNode {
  return (
    <BaseSwitch.Root
      {...props}
      {...mergeStyles<BaseSwitch.Root.State>({ className, style, styles: stylex.props(styles.switch, xstyle) })}
    />
  );
}

function SwitchThumb({ className, style, ...props }: SwitchThumbProps): ReactNode {
  return (
    <BaseSwitch.Thumb
      {...props}
      {...mergeStyles<BaseSwitch.Thumb.State>({ className, style, styles: stylex.props(styles.thumb) })}
    />
  );
}

function ToggleGroupRoot<Value extends string>({
  className,
  style,
  xstyle,
  ...props
}: ToggleGroupRootProps<Value>): ReactNode {
  return (
    <BaseToggleGroup<Value>
      {...props}
      {...mergeStyles<BaseToggleGroup.State>({ className, style, styles: stylex.props(styles.toggles, xstyle) })}
    />
  );
}

function ToggleItem<Value extends string>({ className, style, ...props }: ToggleItemProps<Value>): ReactNode {
  return (
    <BaseToggle<Value>
      {...props}
      {...mergeStyles<BaseToggle.State>({ className, style, styles: stylex.props(styles.toggle) })}
    />
  );
}

export const Checkbox = { Root: CheckboxRoot, Indicator: CheckboxIndicator };
export const RadioGroup = { Root: RadioGroupRoot, Item: RadioItem, Indicator: RadioIndicator };
export const Switch = { Root: SwitchRoot, Thumb: SwitchThumb };
export const ToggleGroup = { Root: ToggleGroupRoot, Item: ToggleItem };
