import * as stylex from '@stylexjs/stylex';
import * as ComboboxSdk from '@ui-sdk/react/combobox';
import { mergeProps } from '@ui-sdk/react/primitive';
import { Check, ChevronDown, X } from 'lucide-react';
import { createContext, useContext } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type { ControlDensity } from '../../foundations/src/control-density.ts';
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
import type { MultipleSelectionOf, SelectionProperties, SingleSelectionOf } from './selection-state.ts';
import { selectionStyles } from './selection-styles.ts';

const ComboboxDensityContext = createContext<ControlDensity>('standard');

const styles = stylex.create({
  inputGroup: { gap: spacing.xs },
  input: { flex: '1 1 12ch', width: '12ch' },
  action: {
    'display': 'inline-flex',
    ':is([hidden])': { display: 'none' },
    'alignItems': 'center',
    'justifyContent': 'center',
    'flexShrink': 0,
    'boxSizing': 'border-box',
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
    ':is([hidden])': { display: 'none' },
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
  | { readonly query: string; readonly defaultQuery?: never; readonly onQueryChange: Change }
  | { readonly query?: never; readonly defaultQuery?: string; readonly onQueryChange?: Change };

type ComboboxRootProps<Value> = (
  | SelectionProperties<SingleSelectionOf<ComboboxSdk.ComboboxProps<Value>>>
  | SelectionProperties<MultipleSelectionOf<ComboboxSdk.ComboboxProps<Value, true>>>
) &
  InputQueryProperties<NonNullable<ComboboxSdk.ComboboxProps<Value>['onQueryChange']>> & {
    readonly density?: ControlDensity;
    readonly items?: never;
  };

type ComboboxInputGroupProps = ComponentProps<'div'> & { readonly xstyle?: PlacementStyle };
type ComboboxLabelProps = ComponentProps<typeof ComboboxSdk.ComboboxLabel>;

type ComboboxInputProps = ComponentProps<typeof ComboboxSdk.ComboboxInput>;
type ComboboxTriggerProps = ComponentProps<typeof ComboboxSdk.ComboboxTrigger>;
type ComboboxClearProps = ComponentProps<typeof ComboboxSdk.ComboboxClear>;
type ComboboxContentProps = ComponentProps<typeof ComboboxSdk.ComboboxContent> & { readonly xstyle?: PlacementStyle };

type ComboboxListProps = ComponentProps<typeof ComboboxSdk.ComboboxList>;

type ComboboxItemProps = ComponentProps<typeof ComboboxSdk.ComboboxItem>;
type ComboboxIndicatorProps = ComponentProps<typeof ComboboxSdk.ComboboxItemIndicator>;
type ComboboxEmptyProps = ComponentProps<typeof ComboboxSdk.ComboboxEmpty>;
type ComboboxStatusProps = ComponentProps<typeof ComboboxSdk.ComboboxStatus>;
type ComboboxGroupLabelProps = ComponentProps<typeof ComboboxSdk.ComboboxGroupLabel>;
type ComboboxChipsProps = ComponentProps<typeof ComboboxSdk.ComboboxChips>;
type ComboboxChipProps = ComponentProps<typeof ComboboxSdk.ComboboxChip>;
type ComboboxChipRemoveProps = ComponentProps<typeof ComboboxSdk.ComboboxChipRemove>;

function ComboboxRoot<Value>(props: ComboboxRootProps<Value>): ReactNode {
  return (
    <ComboboxDensityContext value={props.density ?? 'standard'}>
      {props.multiple === true ? (
        <ComboboxSdk.Combobox<Value, true> {...props} />
      ) : (
        <ComboboxSdk.Combobox<Value> {...props} />
      )}
    </ComboboxDensityContext>
  );
}

function ComboboxInputGroup({ xstyle, ...props }: ComboboxInputGroupProps): ReactNode {
  const density = useContext(ComboboxDensityContext);

  return (
    <div
      {...mergeProps(
        stylex.props(controlStyles.group, controlTargetDensityStyles[density], styles.inputGroup, xstyle),
        props,
      )}
    />
  );
}

function ComboboxLabel({ className, style, ...props }: ComboboxLabelProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxLabel
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(controlStyles.label) })}
    />
  );
}

function ComboboxInput({ className, style, ...props }: ComboboxInputProps): ReactNode {
  const density = useContext(ComboboxDensityContext);

  return (
    <ComboboxSdk.ComboboxInput
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
  const density = useContext(ComboboxDensityContext);

  return (
    <ComboboxSdk.ComboboxTrigger
      {...props}
      aria-label={label}
      {...mergeStyles({ className, style, styles: stylex.props(actionTargetDensityStyles[density], styles.action) })}
    >
      {children}
    </ComboboxSdk.ComboboxTrigger>
  );
}

function ComboboxClear({
  children = <X size={16} aria-hidden="true" />,
  'aria-label': label = 'Clear selection',
  className,
  style,
  ...props
}: ComboboxClearProps): ReactNode {
  const density = useContext(ComboboxDensityContext);

  return (
    <ComboboxSdk.ComboboxClear
      {...props}
      aria-label={label}
      {...mergeStyles({ className, style, styles: stylex.props(actionTargetDensityStyles[density], styles.action) })}
    >
      {children}
    </ComboboxSdk.ComboboxClear>
  );
}

function ComboboxPopup({ className, style, xstyle, sideOffset = 4, ...props }: ComboboxContentProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxContent
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<ComboboxSdk.ComboboxContentState>({
        className,
        style,
        styles: stylex.props(selectionStyles.popup, selectionStyles.positioner, xstyle),
      })}
    />
  );
}

function ComboboxList({ className, style, ...props }: ComboboxListProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxList
      {...props}
      {...mergeStyles<ComboboxSdk.ComboboxContentState>({ className, style, styles: stylex.props(styles.list) })}
    />
  );
}

function ComboboxItem({ className, style, ...props }: ComboboxItemProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxItem
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(selectionStyles.option) })}
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
    <ComboboxSdk.ComboboxItemIndicator
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(selectionStyles.icon) })}
    >
      {children}
    </ComboboxSdk.ComboboxItemIndicator>
  );
}

function ComboboxEmpty({ className, style, ...props }: ComboboxEmptyProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxEmpty {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.status) })} />
  );
}

function ComboboxStatus({ className, style, ...props }: ComboboxStatusProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxStatus
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.status) })}
    />
  );
}

function ComboboxGroupLabel({ className, style, ...props }: ComboboxGroupLabelProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxGroupLabel
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.groupLabel) })}
    />
  );
}

function ComboboxChips({ className, style, ...props }: ComboboxChipsProps): ReactNode {
  return (
    <ComboboxSdk.ComboboxChips {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.chips) })} />
  );
}

function ComboboxChip({ className, style, ...props }: ComboboxChipProps): ReactNode {
  const density = useContext(ComboboxDensityContext);

  return (
    <ComboboxSdk.ComboboxChip
      {...props}
      {...mergeStyles({
        className,
        style,
        styles: stylex.props(controlStyles.group, controlTargetDensityStyles[density], styles.chip),
      })}
    />
  );
}

function ComboboxChipRemove({
  children = <X size={16} aria-hidden="true" />,
  className,
  style,
  ...props
}: ComboboxChipRemoveProps): ReactNode {
  const density = useContext(ComboboxDensityContext);

  return (
    <ComboboxSdk.ComboboxChipRemove
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(actionTargetDensityStyles[density], styles.action) })}
    >
      {children}
    </ComboboxSdk.ComboboxChipRemove>
  );
}

export const Combobox = {
  Root: ComboboxRoot,
  Label: ComboboxLabel,
  InputGroup: ComboboxInputGroup,
  Input: ComboboxInput,
  Trigger: ComboboxTrigger,
  Clear: ComboboxClear,
  Popup: ComboboxPopup,
  List: ComboboxList,
  Item: ComboboxItem,
  ItemIndicator: ComboboxIndicator,
  Empty: ComboboxEmpty,
  Status: ComboboxStatus,
  Group: ComboboxSdk.ComboboxGroup,
  GroupLabel: ComboboxGroupLabel,
  Chips: ComboboxChips,
  Chip: ComboboxChip,
  ChipRemove: ComboboxChipRemove,
  Value: ComboboxSdk.ComboboxValue,
};
