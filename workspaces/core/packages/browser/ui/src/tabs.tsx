import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  panel: { paddingTop: 24 },
  list: {
    display: 'flex',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    overflowX: 'auto',
  },
  tab: {
    'fontFamily': 'inherit',
    'borderWidth': 0,
    'minHeight': 44,
    'paddingBlock': 10,
    'paddingInline': 0,
    'backgroundColor': 'transparent',
    'borderBottomWidth': 2,
    'borderBottomStyle': 'solid',
    'borderBottomColor': 'transparent',
    'color': colors.muted,
    'cursor': 'pointer',
    'fontSize': 14,
    'lineHeight': '20px',
    'whiteSpace': 'nowrap',
    ':hover': { color: colors.ink },
    ':is([data-active])': { borderBottomColor: colors.ink, color: colors.ink },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: -2 },
  },
});

export function Tabs<T extends string>({
  options,
  label,
  value,
  onChange,
  children,
}: {
  readonly options: ReadonlyArray<T>;
  readonly label: string;
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
      <BaseTabs.List aria-label={label} {...stylex.props(styles.list)}>
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
