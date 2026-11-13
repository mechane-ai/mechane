import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { ValueStateProperties } from '../../foundations/src/control-state.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { colors, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { tabStyles } from './tab-styles.ts';

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
      {...mergeStyles<BaseTabs.List.State>({ className, style, styles: stylex.props(tabStyles.list) })}
    />
  );
}

function TabsTab({ className, style, ...props }: TabsTabProps): ReactNode {
  return (
    <BaseTabs.Tab
      {...props}
      {...mergeStyles<BaseTabs.Tab.State>({ className, style, styles: stylex.props(tabStyles.item) })}
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
