import { Select as BaseSelect } from '@base-ui/react/select';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { OpenStateProperties, ReadOnlyValueProperties, ValueStateProperties } from './control-state.ts';
import { mergeStyles } from './style-composition.ts';
import type { ControlStyle, PlacementStyle } from './style-composition.ts';
import { colors, conditions, controls, layers, radii, shadows, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  trigger: {
    'display': 'inline-flex',
    'boxSizing': 'border-box',
    'alignItems': 'center',
    'justifyContent': 'space-between',
    'gap': spacing.sm,
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingBlock': 0,
    'paddingInline': controls.paddingInline,
    'minWidth': 0,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderRadius': radii.sm,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.inputSize,
    'lineHeight': typography.bodyLineHeight,
    'textAlign': 'left',
    'color': colors.ink,
    'cursor': 'pointer',
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':is([data-invalid])': { borderColor: colors.danger },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  outlined: { backgroundColor: colors.surface, borderColor: colors.line },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 },
  value: { minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  icon: { display: 'inline-flex', flexShrink: 0, alignItems: 'center' },
  positioner: { zIndex: layers.popup, minWidth: 'var(--anchor-width)', maxWidth: 'calc(100vw - 16px)' },
  popup: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.xs,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    boxShadow: shadows.popup,
    maxHeight: 'var(--available-height)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  option: {
    'display': 'flex',
    'alignItems': 'center',
    'gap': spacing.sm,
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingInline': spacing.sm,
    'borderRadius': radii.sm,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.inputSize,
    'lineHeight': typography.bodyLineHeight,
    'cursor': 'pointer',
    'outlineWidth': 0,
    ':is([data-highlighted])': { backgroundColor: colors.canvas },
    ':is([data-disabled])': { color: colors.muted, cursor: 'default' },
  },
  optionText: { flex: 1, minWidth: 0, overflowWrap: 'anywhere' },
});

type SelectVariant = 'outline' | 'ghost';

type SelectRootProps<Value, Multiple extends boolean | undefined> = Omit<
  BaseSelect.Root.Props<Value, Multiple>,
  'value' | 'defaultValue' | 'onValueChange' | 'open' | 'defaultOpen' | 'onOpenChange'
> &
  OpenStateProperties<NonNullable<BaseSelect.Root.Props<Value, Multiple>['onOpenChange']>> &
  (
    | ValueStateProperties<
        Exclude<BaseSelect.Root.Props<Value, Multiple>['value'], undefined>,
        NonNullable<BaseSelect.Root.Props<Value, Multiple>['onValueChange']>
      >
    | ReadOnlyValueProperties<
        Exclude<BaseSelect.Root.Props<Value, Multiple>['value'], undefined>,
        NonNullable<BaseSelect.Root.Props<Value, Multiple>['onValueChange']>
      >
  );

type SelectTriggerProps = ComponentProps<typeof BaseSelect.Trigger> & {
  readonly variant?: SelectVariant;
  readonly xstyle?: ControlStyle;
};

type SelectValueProps = ComponentProps<typeof BaseSelect.Value> & { readonly xstyle?: PlacementStyle };
type SelectIconProps = ComponentProps<typeof BaseSelect.Icon>;
type SelectPositionerProps = ComponentProps<typeof BaseSelect.Positioner> & { readonly xstyle?: PlacementStyle };
type SelectPopupProps = ComponentProps<typeof BaseSelect.Popup>;
type SelectItemProps = ComponentProps<typeof BaseSelect.Item>;
type SelectItemTextProps = ComponentProps<typeof BaseSelect.ItemText>;
type SelectItemIndicatorProps = ComponentProps<typeof BaseSelect.ItemIndicator>;

const variants = { outline: styles.outlined, ghost: styles.ghost } satisfies Record<SelectVariant, stylex.StyleXStyles>;

function SelectRoot<Value, Multiple extends boolean | undefined = false>(
  props: SelectRootProps<Value, Multiple>,
): ReactNode {
  return <BaseSelect.Root<Value, Multiple> {...props} />;
}

function SelectTrigger({ variant = 'outline', className, style, xstyle, ...props }: SelectTriggerProps): ReactNode {
  return (
    <BaseSelect.Trigger
      {...props}
      {...mergeStyles<BaseSelect.Trigger.State>({
        className,
        style,
        styles: stylex.props(styles.trigger, variants[variant], xstyle),
      })}
    />
  );
}

function SelectValue({ className, style, xstyle, ...props }: SelectValueProps): ReactNode {
  return (
    <BaseSelect.Value
      {...props}
      {...mergeStyles<BaseSelect.Value.State>({ className, style, styles: stylex.props(styles.value, xstyle) })}
    />
  );
}

function SelectIcon({ className, style, ...props }: SelectIconProps): ReactNode {
  return (
    <BaseSelect.Icon
      {...props}
      {...mergeStyles<BaseSelect.Icon.State>({ className, style, styles: stylex.props(styles.icon) })}
    />
  );
}

function SelectPositioner({
  className,
  style,
  xstyle,
  sideOffset = 4,
  alignItemWithTrigger = false,
  ...props
}: SelectPositionerProps): ReactNode {
  return (
    <BaseSelect.Positioner
      {...props}
      sideOffset={sideOffset}
      alignItemWithTrigger={alignItemWithTrigger}
      {...mergeStyles<BaseSelect.Positioner.State>({
        className,
        style,
        styles: stylex.props(styles.positioner, xstyle),
      })}
    />
  );
}

function SelectPopup({ className, style, ...props }: SelectPopupProps): ReactNode {
  return (
    <BaseSelect.Popup
      {...props}
      {...mergeStyles<BaseSelect.Popup.State>({ className, style, styles: stylex.props(styles.popup) })}
    />
  );
}

function SelectItem({ className, style, ...props }: SelectItemProps): ReactNode {
  return (
    <BaseSelect.Item
      {...props}
      {...mergeStyles<BaseSelect.Item.State>({ className, style, styles: stylex.props(styles.option) })}
    />
  );
}

function SelectItemText({ className, style, ...props }: SelectItemTextProps): ReactNode {
  return (
    <BaseSelect.ItemText
      {...props}
      {...mergeStyles<BaseSelect.ItemText.State>({ className, style, styles: stylex.props(styles.optionText) })}
    />
  );
}

function SelectItemIndicator({ className, style, ...props }: SelectItemIndicatorProps): ReactNode {
  return (
    <BaseSelect.ItemIndicator
      {...props}
      {...mergeStyles<BaseSelect.ItemIndicator.State>({ className, style, styles: stylex.props(styles.icon) })}
    />
  );
}

export const Select = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Icon: SelectIcon,
  Portal: BaseSelect.Portal,
  Positioner: SelectPositioner,
  Popup: SelectPopup,
  List: BaseSelect.List,
  Item: SelectItem,
  ItemText: SelectItemText,
  ItemIndicator: SelectItemIndicator,
};
