import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import { TabsList as SdkList, TabsPanel as SdkPanel, TabsTab as SdkTab, Tabs as SdkTabs } from '@ui-sdk/react/tabs';
import type { ComponentProps, ReactNode } from 'react';
import type { ValueStateProperties } from '../../foundations/src/control-state.ts';
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

type TabsRootProps<Value extends string> = Omit<ComponentProps<'div'>, 'defaultValue'> &
  ValueStateProperties<Value | null, (value: Value | null) => void> & {
    readonly orientation?: 'horizontal' | 'vertical';
    readonly activation?: 'automatic' | 'manual';
  };

function TabsRoot<Value extends string>(props: TabsRootProps<Value>): ReactNode {
  return <SdkTabs<Value> {...mergeProps(stylex.props(styles.root), props)} />;
}

function TabsList(props: ComponentProps<'div'>): ReactNode {
  return <SdkList {...mergeProps(stylex.props(tabStyles.list), props)} />;
}

function TabsTab({ value, ...props }: Omit<ComponentProps<'button'>, 'value'> & { readonly value: string }): ReactNode {
  return <SdkTab value={value} {...mergeProps(stylex.props(tabStyles.item), props)} />;
}

function TabsPanel({ value, ...props }: ComponentProps<'div'> & { readonly value: string }): ReactNode {
  return <SdkPanel value={value} {...mergeProps(stylex.props(styles.panel), props)} />;
}

export const Tabs = { Root: TabsRoot, List: TabsList, Tab: TabsTab, Panel: TabsPanel };
