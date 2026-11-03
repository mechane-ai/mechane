import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  panel: { paddingTop: 18 },
  list: {
    display: 'flex',
    gap: 22,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    overflowX: 'auto',
  },
  tab: {
    'fontFamily': 'inherit',
    'borderWidth': 0,
    'padding': '10px 0',
    'backgroundColor': 'transparent',
    'borderBottomWidth': 2,
    'borderBottomStyle': 'solid',
    'borderBottomColor': 'transparent',
    'color': colors.muted,
    'cursor': 'pointer',
    'fontSize': 13,
    'whiteSpace': 'nowrap',
    ':hover': { color: colors.ink },
    ':is([data-active])': { borderBottomColor: colors.ink, color: colors.ink },
  },
});

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  children,
}: {
  readonly options: ReadonlyArray<T>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(next) => {
        const selected = options.find((option) => option === next);

        if (selected !== undefined) {
          onChange(selected);
        }
      }}
    >
      <BaseTabs.List aria-label="Mech details" {...stylex.props(styles.list)}>
        {options.map((option) => (
          <BaseTabs.Tab key={option} value={option} {...stylex.props(styles.tab)}>
            {option}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      <BaseTabs.Panel value={value} {...stylex.props(styles.panel)}>
        {children}
      </BaseTabs.Panel>
    </BaseTabs.Root>
  );
}
