import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import * as stylex from '@stylexjs/stylex';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import type { OpenStateProperties, ValueStateProperties } from '../../foundations/src/control-state.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { colors, conditions, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: {
    minWidth: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    color: colors.ink,
  },
  item: { borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: colors.line },
  header: { margin: 0, fontSize: 'inherit', fontWeight: 'inherit' },
  trigger: {
    'display': 'flex',
    'alignItems': 'center',
    'justifyContent': 'space-between',
    'gap': spacing.sm,
    'width': '100%',
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingInline': 0,
    'paddingBlock': spacing.sm,
    'borderWidth': 0,
    'backgroundColor': {
      'default': 'transparent',
      ':hover:not([data-disabled])': { default: null, [conditions.hoverPointer]: colors.canvas },
      ':active:not([data-disabled])': colors.canvas,
    },
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'lineHeight': 'inherit',
    'fontWeight': typography.mediumWeight,
    'color': 'inherit',
    'textAlign': 'start',
    'overflowWrap': 'anywhere',
    'cursor': 'pointer',
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  icon: {
    flexShrink: 0,
    width: controls.iconSize,
    height: controls.iconSize,
    color: colors.muted,
    transform: { default: 'rotate(-90deg)', [stylex.when.ancestor('[data-panel-open]')]: 'rotate(0deg)' },
  },
  panel: { paddingBottom: spacing.md, overflowWrap: 'anywhere' },
});

type AccordionRootProps<Value> = Omit<BaseAccordion.Root.Props<Value>, 'value' | 'defaultValue' | 'onValueChange'> &
  ValueStateProperties<Array<Value>, NonNullable<BaseAccordion.Root.Props<Value>['onValueChange']>>;

type AccordionItemProps = ComponentProps<typeof BaseAccordion.Item>;
type AccordionHeaderProps = ComponentProps<typeof BaseAccordion.Header>;
type AccordionTriggerProps = ComponentProps<typeof BaseAccordion.Trigger>;
type AccordionPanelProps = ComponentProps<typeof BaseAccordion.Panel>;

type CollapsibleRootProps = Omit<BaseCollapsible.Root.Props, 'open' | 'defaultOpen' | 'onOpenChange'> &
  OpenStateProperties<NonNullable<BaseCollapsible.Root.Props['onOpenChange']>>;

type CollapsibleTriggerProps = ComponentProps<typeof BaseCollapsible.Trigger>;
type CollapsiblePanelProps = ComponentProps<typeof BaseCollapsible.Panel>;

function AccordionRoot<Value = string>({ className, style, ...props }: AccordionRootProps<Value>): ReactNode {
  return (
    <BaseAccordion.Root<Value>
      {...props}
      {...mergeStyles<BaseAccordion.Root.State<Value>>({ className, style, styles: stylex.props(styles.root) })}
    />
  );
}

function AccordionItem({ className, style, ...props }: AccordionItemProps): ReactNode {
  return (
    <BaseAccordion.Item
      {...props}
      {...mergeStyles<BaseAccordion.Item.State>({ className, style, styles: stylex.props(styles.item) })}
    />
  );
}

function AccordionHeader({ className, style, ...props }: AccordionHeaderProps): ReactNode {
  return (
    <BaseAccordion.Header
      {...props}
      {...mergeStyles<BaseAccordion.Header.State>({ className, style, styles: stylex.props(styles.header) })}
    />
  );
}

function AccordionTrigger({ className, style, children, ...props }: AccordionTriggerProps): ReactNode {
  return (
    <BaseAccordion.Trigger
      {...props}
      {...mergeStyles<BaseAccordion.Trigger.State>({
        className,
        style,
        styles: stylex.props(styles.trigger, stylex.defaultMarker()),
      })}
    >
      {children}
      <ChevronDown aria-hidden {...stylex.props(styles.icon)} />
    </BaseAccordion.Trigger>
  );
}

function AccordionPanel({ className, style, ...props }: AccordionPanelProps): ReactNode {
  return (
    <BaseAccordion.Panel
      {...props}
      {...mergeStyles<BaseAccordion.Panel.State>({ className, style, styles: stylex.props(styles.panel) })}
    />
  );
}

function CollapsibleRoot({ className, style, ...props }: CollapsibleRootProps): ReactNode {
  return (
    <BaseCollapsible.Root
      {...props}
      {...mergeStyles<BaseCollapsible.Root.State>({ className, style, styles: stylex.props(styles.root) })}
    />
  );
}

function CollapsibleTrigger({ className, style, children, ...props }: CollapsibleTriggerProps): ReactNode {
  return (
    <BaseCollapsible.Trigger
      {...props}
      {...mergeStyles<BaseCollapsible.Trigger.State>({
        className,
        style,
        styles: stylex.props(styles.trigger, stylex.defaultMarker()),
      })}
    >
      {children}
      <ChevronDown aria-hidden {...stylex.props(styles.icon)} />
    </BaseCollapsible.Trigger>
  );
}

function CollapsiblePanel({ className, style, ...props }: CollapsiblePanelProps): ReactNode {
  return (
    <BaseCollapsible.Panel
      {...props}
      {...mergeStyles<BaseCollapsible.Panel.State>({ className, style, styles: stylex.props(styles.panel) })}
    />
  );
}

export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
};

export const Collapsible = { Root: CollapsibleRoot, Trigger: CollapsibleTrigger, Panel: CollapsiblePanel };
