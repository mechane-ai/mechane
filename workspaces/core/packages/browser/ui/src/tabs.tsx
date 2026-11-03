import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { colors, controls, spacing, typography } from '@mechane/ui-tokens/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { ValueStateProperties } from './control-state.ts';
import { mergeStyles } from './style-composition.ts';

const styles = stylex.create({
  root: { fontFamily: typography.fontFamily, WebkitFontSmoothing: 'antialiased', minWidth: 0 },
  panel: { paddingTop: spacing.xl, outlineWidth: 0 },
  list: {
    display: 'flex',
    gap: spacing.xl,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    overflowX: 'auto',
  },
  tab: {
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'borderWidth': 0,
    'minHeight': controls.coarseTarget,
    'paddingBlock': 10,
    'paddingInline': 0,
    'backgroundColor': 'transparent',
    'borderBottomWidth': 2,
    'borderBottomStyle': 'solid',
    'borderBottomColor': 'transparent',
    'color': colors.muted,
    'cursor': 'pointer',
    'fontSize': typography.inputSize,
    'lineHeight': typography.bodyLineHeight,
    'whiteSpace': 'nowrap',
    ':hover:not([data-disabled])': { color: colors.ink },
    ':is([data-active])': { borderBottomColor: colors.ink, color: colors.ink },
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
});

type BaseTabsRootProps = ComponentProps<typeof BaseTabs.Root>;

type TabsRootProps = Omit<BaseTabsRootProps, 'value' | 'defaultValue' | 'onValueChange'> &
  ValueStateProperties<Exclude<BaseTabsRootProps['value'], undefined>, NonNullable<BaseTabsRootProps['onValueChange']>>;

type TabsListProps = ComponentProps<typeof BaseTabs.List>;
type TabsTabProps = ComponentProps<typeof BaseTabs.Tab>;
type TabsPanelProps = ComponentProps<typeof BaseTabs.Panel>;

function TabsRoot({ className, style, ...props }: TabsRootProps): ReactNode {
  return (
    <BaseTabs.Root
      {...props}
      {...mergeStyles<BaseTabs.Root.State>({ className, style, styles: stylex.props(styles.root) })}
    />
  );
}

function TabsList({ className, style, ...props }: TabsListProps): ReactNode {
  return (
    <BaseTabs.List
      {...props}
      {...mergeStyles<BaseTabs.List.State>({ className, style, styles: stylex.props(styles.list) })}
    />
  );
}

function TabsTab({ className, style, ...props }: TabsTabProps): ReactNode {
  return (
    <BaseTabs.Tab
      {...props}
      {...mergeStyles<BaseTabs.Tab.State>({ className, style, styles: stylex.props(styles.tab) })}
    />
  );
}

function TabsPanel({ className, style, ...props }: TabsPanelProps): ReactNode {
  return (
    <BaseTabs.Panel
      {...props}
      {...mergeStyles<BaseTabs.Panel.State>({ className, style, styles: stylex.props(styles.panel) })}
    />
  );
}

export const Tabs = { Root: TabsRoot, List: TabsList, Tab: TabsTab, Panel: TabsPanel };
