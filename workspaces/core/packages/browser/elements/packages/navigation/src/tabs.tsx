import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { ValueStateProperties } from '../../foundations/src/control-state.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { colors, conditions, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: {
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'color': colors.ink,
    'WebkitFontSmoothing': 'antialiased',
    'minWidth': 0,
    ':is([data-orientation="vertical"])': { display: 'flex', alignItems: 'flex-start', gap: spacing.xl },
  },
  panel: {
    'paddingTop': spacing.xl,
    'minWidth': 0,
    'outlineWidth': 0,
    ':is([data-orientation="vertical"])': { paddingTop: 0, flex: 1 },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  list: {
    'display': 'flex',
    'gap': 0,
    'minWidth': 0,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'overflowX': 'auto',
    ':is([data-orientation="vertical"])': {
      flexDirection: 'column',
      flexShrink: 0,
      maxWidth: '50%',
      borderBottomWidth: 0,
      borderInlineEndWidth: 1,
      borderInlineEndStyle: 'solid',
      borderInlineEndColor: colors.line,
    },
  },
  tab: {
    'position': 'relative',
    'boxSizing': 'border-box',
    'flexShrink': 0,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'WebkitFontSmoothing': 'antialiased',
    'borderWidth': 0,
    'minHeight': controls.coarseTarget,
    'paddingBlock': spacing.sm,
    'paddingInline': spacing.md,
    'backgroundColor': 'transparent',
    'color': colors.muted,
    'cursor': 'pointer',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'whiteSpace': 'nowrap',
    ':hover:not([data-disabled])': { color: { [conditions.hoverPointer]: colors.ink } },
    ':active:not([data-disabled])': { backgroundColor: colors.canvas, color: colors.ink },
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: spacing.md,
      bottom: 0,
      height: 2,
      backgroundColor: 'transparent',
    },
    ':is([data-active])': { 'color': colors.ink, '::after': { backgroundColor: colors.ink } },
    ':is([data-orientation="vertical"])': {
      'textAlign': 'start',
      'whiteSpace': 'normal',
      'overflowWrap': 'anywhere',
      '::after': {
        insetInlineStart: 'auto',
        insetInlineEnd: 0,
        top: spacing.sm,
        bottom: spacing.sm,
        width: 2,
        height: 'auto',
      },
    },
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
