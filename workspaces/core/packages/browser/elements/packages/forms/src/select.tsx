import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import * as SelectSdk from '@ui-sdk/react/select';
import type { ComponentProps, ReactNode } from 'react';
import type { ControlDensity } from '../../foundations/src/control-density.ts';
import {
  actionTargetDensityStyles,
  controlDensityStyles,
  controlStyles,
} from '../../foundations/src/control-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import type { MultipleSelectionOf, SelectionProperties, SingleSelectionOf } from './selection-state.ts';
import { selectionStyles as styles } from './selection-styles.ts';

type SelectVariant = 'outline' | 'ghost';

type SelectRootProps<Value> =
  | SelectionProperties<SingleSelectionOf<SelectSdk.SelectProps<Value>>>
  | SelectionProperties<MultipleSelectionOf<SelectSdk.SelectProps<Value, true>>>;

type SelectTriggerProps = ComponentProps<typeof SelectSdk.SelectTrigger> & {
  readonly variant?: SelectVariant;
  readonly density?: ControlDensity;
  readonly xstyle?: PlacementStyle;
};

type SelectValueProps = ComponentProps<typeof SelectSdk.SelectValue> & { readonly xstyle?: PlacementStyle };
type SelectIconProps = ComponentProps<'span'>;
type SelectContentProps = ComponentProps<typeof SelectSdk.SelectContent> & { readonly xstyle?: PlacementStyle };
type SelectItemProps = ComponentProps<typeof SelectSdk.SelectItem>;
type SelectItemTextProps = ComponentProps<typeof SelectSdk.SelectItemText>;
type SelectItemIndicatorProps = ComponentProps<typeof SelectSdk.SelectItemIndicator>;

const variants = { outline: styles.outlined, ghost: styles.ghost } satisfies Record<SelectVariant, stylex.StyleXStyles>;

function SelectRoot<Value>(props: SelectRootProps<Value>): ReactNode {
  if (props.multiple === true) {
    return <SelectSdk.Select<Value, true> {...props} />;
  }

  return <SelectSdk.Select<Value> {...props} />;
}

function SelectTrigger({
  variant = 'outline',
  density = 'standard',
  className,
  style,
  xstyle,
  ...props
}: SelectTriggerProps): ReactNode {
  return (
    <SelectSdk.SelectTrigger
      {...props}
      {...mergeStyles<SelectSdk.SelectTriggerState>({
        className,
        style,
        styles: stylex.props(
          controlStyles.base,
          styles.trigger,
          variants[variant],
          controlDensityStyles[density],
          actionTargetDensityStyles[density],
          xstyle,
        ),
      })}
    />
  );
}

function SelectValue({ className, style, xstyle, ...props }: SelectValueProps): ReactNode {
  return (
    <SelectSdk.SelectValue
      {...props}
      {...mergeStyles<SelectSdk.SelectValueState>({ className, style, styles: stylex.props(styles.value, xstyle) })}
    />
  );
}

function SelectIcon(props: SelectIconProps): ReactNode {
  return <span aria-hidden {...mergeProps(stylex.props(styles.icon), props)} />;
}

function SelectPopup({ xstyle, className, style, sideOffset = 4, ...props }: SelectContentProps): ReactNode {
  return (
    <SelectSdk.SelectContent
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<SelectSdk.SelectContentState>({
        className,
        style,
        styles: stylex.props(styles.popup, styles.positioner, xstyle),
      })}
    />
  );
}

function SelectItem({ className, style, ...props }: SelectItemProps): ReactNode {
  return (
    <SelectSdk.SelectItem
      {...props}
      {...mergeStyles<SelectSdk.SelectItemState>({ className, style, styles: stylex.props(styles.option) })}
    />
  );
}

function SelectItemText({ className, style, ...props }: SelectItemTextProps): ReactNode {
  return (
    <SelectSdk.SelectItemText
      {...props}
      {...mergeStyles<SelectSdk.SelectItemTextState>({ className, style, styles: stylex.props(styles.optionText) })}
    />
  );
}

function SelectItemIndicator({ className, style, ...props }: SelectItemIndicatorProps): ReactNode {
  return (
    <SelectSdk.SelectItemIndicator
      {...props}
      {...mergeStyles<SelectSdk.SelectItemIndicatorState>({ className, style, styles: stylex.props(styles.icon) })}
    />
  );
}

export const Select = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Icon: SelectIcon,
  Popup: SelectPopup,
  List: SelectSdk.SelectList,
  Item: SelectItem,
  ItemText: SelectItemText,
  ItemIndicator: SelectItemIndicator,
};
