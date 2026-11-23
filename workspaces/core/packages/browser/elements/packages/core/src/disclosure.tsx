import * as stylex from '@stylexjs/stylex';
import * as SdkAccordion from '@ui-sdk/react/accordion';
import * as SdkCollapsible from '@ui-sdk/react/collapsible';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type { OpenStateProperties, ValueStateProperties } from '../../foundations/src/control-state.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { colors, controls, motion, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

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
    'minHeight': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
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
  inline: {
    'width': 'fit-content',
    'paddingBlock': 0,
    'maxWidth': '100%',
    'justifyContent': 'flex-start',
    'gap': spacing.xs,
    'color': colors.muted,
    'fontWeight': typography.regularWeight,
    ':hover:not([data-disabled])': { color: { default: null, [conditions.hoverPointer]: colors.ink } },
  },
  inlineIcon: {
    width: 14,
    height: 14,
    transitionProperty: 'transform',
    transitionDuration: { default: motion.duration, [conditions.reducedMotion]: '0ms' },
    transitionTimingFunction: motion.easing,
  },
  icon: {
    flexShrink: 0,
    width: controls.iconSize,
    height: controls.iconSize,
    color: colors.muted,
    transform: { default: 'rotate(-90deg)', [stylex.when.ancestor('[aria-expanded="true"]')]: 'rotate(0deg)' },
  },
  panel: { paddingBottom: spacing.md, overflowWrap: 'anywhere' },
});

const triggerStyles = { default: null, inline: styles.inline };
const iconStyles = { default: null, inline: styles.inlineIcon };

/** Names the group of sections, so a reader and an agent can tell one accordion from another. */
type AccordionName =
  | { readonly 'aria-label': string; readonly 'aria-labelledby'?: undefined }
  | { readonly 'aria-labelledby': string; readonly 'aria-label'?: undefined };

type AccordionRootProps<Value extends string> = Omit<
  ComponentProps<typeof SdkAccordion.Accordion<Value>>,
  'value' | 'defaultValue' | 'onValueChange' | 'aria-label' | 'aria-labelledby'
> &
  AccordionName &
  ValueStateProperties<
    Array<Value>,
    NonNullable<ComponentProps<typeof SdkAccordion.Accordion<Value>>['onValueChange']>
  >;

type AccordionItemProps = ComponentProps<typeof SdkAccordion.AccordionItem<string>>;
type AccordionHeaderProps = ComponentProps<typeof SdkAccordion.AccordionHeader>;

type AccordionTriggerProps = Omit<ComponentProps<typeof SdkAccordion.AccordionTrigger>, 'children'> & {
  readonly children?: ReactNode;
};

type AccordionPanelProps = ComponentProps<typeof SdkAccordion.AccordionPanel>;

type CollapsibleRootProps = Omit<
  ComponentProps<typeof SdkCollapsible.Collapsible>,
  'open' | 'defaultOpen' | 'onOpenChange'
> &
  OpenStateProperties<NonNullable<ComponentProps<typeof SdkCollapsible.Collapsible>['onOpenChange']>>;

type CollapsibleTriggerProps = Omit<ComponentProps<typeof SdkCollapsible.CollapsibleTrigger>, 'children'> & {
  readonly children?: ReactNode;
  readonly variant?: 'default' | 'inline';
};

type CollapsiblePanelProps = ComponentProps<typeof SdkCollapsible.CollapsiblePanel>;

function AccordionRoot<Value extends string = string>({
  className,
  style,
  ...props
}: AccordionRootProps<Value>): ReactNode {
  return (
    <SdkAccordion.Accordion<Value>
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.root) })}
    />
  );
}

function AccordionItem({ className, style, ...props }: AccordionItemProps): ReactNode {
  return (
    <SdkAccordion.AccordionItem {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.item) })} />
  );
}

function AccordionHeader({ className, style, ...props }: AccordionHeaderProps): ReactNode {
  return (
    <SdkAccordion.AccordionHeader
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.header) })}
    />
  );
}

function AccordionTrigger({ className, style, children, ...props }: AccordionTriggerProps): ReactNode {
  return (
    <SdkAccordion.AccordionTrigger
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.trigger, stylex.defaultMarker()) })}
    >
      {children}
      <ChevronDown aria-hidden {...stylex.props(styles.icon)} />
    </SdkAccordion.AccordionTrigger>
  );
}

function AccordionPanel({ className, style, ...props }: AccordionPanelProps): ReactNode {
  return (
    <SdkAccordion.AccordionPanel
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.panel) })}
    />
  );
}

function CollapsibleRoot({ className, style, ...props }: CollapsibleRootProps): ReactNode {
  return (
    <SdkCollapsible.Collapsible {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.root) })} />
  );
}

function CollapsibleTrigger({
  className,
  style,
  children,
  variant = 'default',
  ...props
}: CollapsibleTriggerProps): ReactNode {
  return (
    <SdkCollapsible.CollapsibleTrigger
      {...props}
      {...mergeStyles({
        className,
        style,
        styles: stylex.props(styles.trigger, triggerStyles[variant], stylex.defaultMarker()),
      })}
    >
      {children}
      <ChevronDown aria-hidden {...stylex.props(styles.icon, iconStyles[variant])} />
    </SdkCollapsible.CollapsibleTrigger>
  );
}

function CollapsiblePanel({ className, style, ...props }: CollapsiblePanelProps): ReactNode {
  return (
    <SdkCollapsible.CollapsiblePanel
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(styles.panel) })}
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
