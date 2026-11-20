import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Tabs } from './tabs.tsx';

const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: 'auto',
    paddingTop: 0,
  },
});

export type ContentTab = { readonly id: string; readonly label: string; readonly content: ReactNode };

export type ContentTabsProps = {
  readonly label: string;
  readonly items: ReadonlyArray<ContentTab>;
  readonly defaultSelectedId?: string;
};

export function ContentTabs(props: ContentTabsProps): ReactNode {
  const [localId, setLocalId] = useState(props.defaultSelectedId ?? props.items[0]?.id);
  const selected = props.items.find((item) => item.id === localId) ?? props.items[0];

  return (
    <Tabs.Root
      value={selected?.id ?? null}
      onValueChange={(value) => setLocalId(value ?? undefined)}
      {...stylex.props(styles.root)}
    >
      <Tabs.List aria-label={props.label}>
        {props.items.map((item) => (
          <Tabs.Tab key={item.id} value={item.id}>
            {item.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {selected !== undefined && (
        <Tabs.Panel key={selected.id} value={selected.id} {...stylex.props(styles.panel)}>
          {selected.content}
        </Tabs.Panel>
      )}
    </Tabs.Root>
  );
}
