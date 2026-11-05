import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import * as stylex from '@stylexjs/stylex';
import { Check, ChevronDown, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type {
  OpenStateProperties,
  ReadOnlyValueProperties,
  ValueStateProperties,
} from '../../foundations/src/control-state.ts';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { fieldStyles } from './field-styles.ts';
import { selectionStyles } from './selection-styles.ts';

const styles = stylex.create({
  inputGroup: { gap: spacing.xs },
  input: { flex: '1 1 12ch', width: '12ch' },
  action: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'flexShrink': 0,
    'boxSizing': 'border-box',
    'width': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'minHeight': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'padding': 0,
    'backgroundColor': 'transparent',
    'color': colors.muted,
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
  list: {
    padding: 0,
    margin: 0,
    maxHeight: 'min(320px, var(--available-height))',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    outlineWidth: 0,
  },
  status: {
    'margin': 0,
    'padding': spacing.sm,
    'color': colors.muted,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    ':is(:empty)': { display: 'none' },
  },
  groupLabel: {
    paddingBlock: spacing.xs,
    paddingInline: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.mediumWeight,
  },
  chips: {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    minWidth: 0,
    paddingInline: spacing.xs,
  },
  chip: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'gap': spacing.xs,
    'minWidth': 0,
    'maxWidth': '100%',
    'overflowWrap': 'anywhere',
    'backgroundColor': colors.canvas,
    'paddingInlineStart': spacing.sm,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'color': colors.ink,
    ':is([data-disabled])': { opacity: controls.disabledOpacity },
  },
});

type InputQueryProperties<Change> =
  | { readonly inputValue: string; readonly defaultInputValue?: never; readonly onInputValueChange: Change }
  | { readonly inputValue?: never; readonly defaultInputValue?: string; readonly onInputValueChange?: Change };

type ComboboxRootProps<Value, Multiple extends boolean | undefined, Item> = Omit<
  BaseCombobox.Root.Props<Value, Multiple, Item>,
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'open'
  | 'defaultOpen'
  | 'onOpenChange'
  | 'inputValue'
  | 'defaultInputValue'
  | 'onInputValueChange'
> &
  OpenStateProperties<NonNullable<BaseCombobox.Root.Props<Value, Multiple, Item>['onOpenChange']>> &
  InputQueryProperties<NonNullable<BaseCombobox.Root.Props<Value, Multiple, Item>['onInputValueChange']>> &
  (
    | ValueStateProperties<
        Exclude<BaseCombobox.Root.Props<Value, Multiple, Item>['value'], undefined>,
        NonNullable<BaseCombobox.Root.Props<Value, Multiple, Item>['onValueChange']>
      >
    | ReadOnlyValueProperties<
        Exclude<BaseCombobox.Root.Props<Value, Multiple, Item>['value'], undefined>,
        NonNullable<BaseCombobox.Root.Props<Value, Multiple, Item>['onValueChange']>
      >
  );

type ComboboxInputGroupProps = ComponentProps<typeof BaseCombobox.InputGroup> & { readonly xstyle?: PlacementStyle };
type ComboboxLabelProps = ComponentProps<typeof BaseCombobox.Label>;

type ComboboxValueProps<Value> = Omit<ComponentProps<typeof BaseCombobox.Value>, 'children'> & {
  readonly children?: ReactNode | ((value: Value) => ReactNode);
};

type ComboboxInputProps = ComponentProps<typeof BaseCombobox.Input>;
type ComboboxTriggerProps = ComponentProps<typeof BaseCombobox.Trigger>;
type ComboboxClearProps = ComponentProps<typeof BaseCombobox.Clear>;
type ComboboxPositionerProps = ComponentProps<typeof BaseCombobox.Positioner> & { readonly xstyle?: PlacementStyle };
type ComboboxPopupProps = ComponentProps<typeof BaseCombobox.Popup>;

type ComboboxListProps<Item> = Omit<ComponentProps<typeof BaseCombobox.List>, 'children'> & {
  readonly children?: ReactNode | ((item: Item, index: number) => ReactNode);
};

type ComboboxItemProps = ComponentProps<typeof BaseCombobox.Item>;
type ComboboxIndicatorProps = ComponentProps<typeof BaseCombobox.ItemIndicator>;
type ComboboxEmptyProps = ComponentProps<typeof BaseCombobox.Empty>;
type ComboboxStatusProps = ComponentProps<typeof BaseCombobox.Status>;
type ComboboxGroupLabelProps = ComponentProps<typeof BaseCombobox.GroupLabel>;
type ComboboxChipsProps = ComponentProps<typeof BaseCombobox.Chips>;
type ComboboxChipProps = ComponentProps<typeof BaseCombobox.Chip>;
type ComboboxChipRemoveProps = ComponentProps<typeof BaseCombobox.ChipRemove>;

function ComboboxRoot<Value, Multiple extends boolean | undefined = false, Item = Value>(
  props: ComboboxRootProps<Value, Multiple, Item>,
): ReactNode {
  return <BaseCombobox.Root<Value, Multiple, Item> {...props} />;
}

function ComboboxInputGroup({ className, style, xstyle, ...props }: ComboboxInputGroupProps): ReactNode {
  return (
    <BaseCombobox.InputGroup
      {...props}
      {...mergeStyles<BaseCombobox.InputGroup.State>({
        className,
        style,
        styles: stylex.props(controlStyles.group, styles.inputGroup, xstyle),
      })}
    />
  );
}

function ComboboxLabel({ className, style, ...props }: ComboboxLabelProps): ReactNode {
  return (
    <BaseCombobox.Label
      {...props}
      {...mergeStyles<BaseCombobox.Label.State>({ className, style, styles: stylex.props(controlStyles.label) })}
    />
  );
}

function ComboboxValue<Value>(props: ComboboxValueProps<Value>): ReactNode {
  return <BaseCombobox.Value {...props} />;
}

function ComboboxInput({ className, style, ...props }: ComboboxInputProps): ReactNode {
  return (
    <BaseCombobox.Input
      {...props}
      {...mergeStyles<BaseCombobox.Input.State>({
        className,
        style,
        styles: stylex.props(
          controlStyles.base,
          controlStyles.field,
          fieldStyles.input,
          controlStyles.embedded,
          styles.input,
        ),
      })}
    />
  );
}

function ComboboxTrigger({
  children = <ChevronDown size={16} aria-hidden="true" />,
  'aria-label': label = 'Show options',
  className,
  style,
  ...props
}: ComboboxTriggerProps): ReactNode {
  return (
    <BaseCombobox.Trigger
      {...props}
      aria-label={label}
      {...mergeStyles<BaseCombobox.Trigger.State>({ className, style, styles: stylex.props(styles.action) })}
    >
      {children}
    </BaseCombobox.Trigger>
  );
}

function ComboboxClear({
  children = <X size={16} aria-hidden="true" />,
  'aria-label': label = 'Clear selection',
  className,
  style,
  ...props
}: ComboboxClearProps): ReactNode {
  return (
    <BaseCombobox.Clear
      {...props}
      aria-label={label}
      {...mergeStyles<BaseCombobox.Clear.State>({ className, style, styles: stylex.props(styles.action) })}
    >
      {children}
    </BaseCombobox.Clear>
  );
}

function ComboboxPositioner({
  sideOffset = 4,
  className,
  style,
  xstyle,
  ...props
}: ComboboxPositionerProps): ReactNode {
  return (
    <BaseCombobox.Positioner
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<BaseCombobox.Positioner.State>({
        className,
        style,
        styles: stylex.props(selectionStyles.positioner, xstyle),
      })}
    />
  );
}

function ComboboxPopup({ className, style, ...props }: ComboboxPopupProps): ReactNode {
  return (
    <BaseCombobox.Popup
      {...props}
      {...mergeStyles<BaseCombobox.Popup.State>({ className, style, styles: stylex.props(selectionStyles.popup) })}
    />
  );
}

function ComboboxList<Item>({ className, style, ...props }: ComboboxListProps<Item>): ReactNode {
  return (
    <BaseCombobox.List
      {...props}
      {...mergeStyles<BaseCombobox.List.State>({ className, style, styles: stylex.props(styles.list) })}
    />
  );
}

function ComboboxItem({ className, style, ...props }: ComboboxItemProps): ReactNode {
  return (
    <BaseCombobox.Item
      {...props}
      {...mergeStyles<BaseCombobox.Item.State>({ className, style, styles: stylex.props(selectionStyles.option) })}
    />
  );
}

function ComboboxIndicator({
  children = <Check size={16} aria-hidden="true" />,
  className,
  style,
  ...props
}: ComboboxIndicatorProps): ReactNode {
  return (
    <BaseCombobox.ItemIndicator
      {...props}
      {...mergeStyles<BaseCombobox.ItemIndicator.State>({
        className,
        style,
        styles: stylex.props(selectionStyles.icon),
      })}
    >
      {children}
    </BaseCombobox.ItemIndicator>
  );
}

function ComboboxEmpty({ className, style, ...props }: ComboboxEmptyProps): ReactNode {
  return (
    <BaseCombobox.Empty
      {...props}
      {...mergeStyles<BaseCombobox.Empty.State>({ className, style, styles: stylex.props(styles.status) })}
    />
  );
}

function ComboboxStatus({ className, style, ...props }: ComboboxStatusProps): ReactNode {
  return (
    <BaseCombobox.Status
      {...props}
      {...mergeStyles<BaseCombobox.Status.State>({ className, style, styles: stylex.props(styles.status) })}
    />
  );
}

function ComboboxGroupLabel({ className, style, ...props }: ComboboxGroupLabelProps): ReactNode {
  return (
    <BaseCombobox.GroupLabel
      {...props}
      {...mergeStyles<BaseCombobox.GroupLabel.State>({ className, style, styles: stylex.props(styles.groupLabel) })}
    />
  );
}

function ComboboxChips({ className, style, ...props }: ComboboxChipsProps): ReactNode {
  return (
    <BaseCombobox.Chips
      {...props}
      {...mergeStyles<BaseCombobox.Chips.State>({ className, style, styles: stylex.props(styles.chips) })}
    />
  );
}

function ComboboxChip({ className, style, ...props }: ComboboxChipProps): ReactNode {
  return (
    <BaseCombobox.Chip
      {...props}
      {...mergeStyles<BaseCombobox.Chip.State>({
        className,
        style,
        styles: stylex.props(controlStyles.group, styles.chip),
      })}
    />
  );
}

function ComboboxChipRemove({
  children = <X size={14} aria-hidden="true" />,
  className,
  style,
  ...props
}: ComboboxChipRemoveProps): ReactNode {
  return (
    <BaseCombobox.ChipRemove
      {...props}
      {...mergeStyles<BaseCombobox.ChipRemove.State>({ className, style, styles: stylex.props(styles.action) })}
    >
      {children}
    </BaseCombobox.ChipRemove>
  );
}

export const Combobox = {
  Root: ComboboxRoot,
  Label: ComboboxLabel,
  InputGroup: ComboboxInputGroup,
  Input: ComboboxInput,
  Trigger: ComboboxTrigger,
  Clear: ComboboxClear,
  Portal: BaseCombobox.Portal,
  Positioner: ComboboxPositioner,
  Popup: ComboboxPopup,
  List: ComboboxList,
  Item: ComboboxItem,
  ItemIndicator: ComboboxIndicator,
  Empty: ComboboxEmpty,
  Status: ComboboxStatus,
  Group: BaseCombobox.Group,
  GroupLabel: ComboboxGroupLabel,
  Chips: ComboboxChips,
  Chip: ComboboxChip,
  ChipRemove: ComboboxChipRemove,
  Value: ComboboxValue,
  Collection: BaseCombobox.Collection,
};
