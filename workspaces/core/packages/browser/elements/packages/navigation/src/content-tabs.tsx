import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PageNavigation } from './page-navigation.tsx';
import { Tabs } from './tabs.tsx';

const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },
  panel: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, paddingTop: 0 },
});

export type ContentTab = { readonly id: string; readonly label: string; readonly content: ReactNode };

export type ContentTabNavigation = {
  readonly selectedId: string;
  readonly onNavigate: (id: string) => void;
  readonly href: (id: string) => string;
};

export type ContentTabsProps = {
  readonly label: string;
  readonly items: ReadonlyArray<ContentTab>;
  readonly navigation?: ContentTabNavigation;
};

export function ContentTabs(props: ContentTabsProps): ReactNode {
  const [localId, setLocalId] = useState(props.items[0]?.id);
  const navigation = props.navigation;
  const selectedId = navigation?.selectedId ?? localId;
  const selected = props.items.find((item) => item.id === selectedId) ?? props.items[0];

  if (navigation !== undefined) {
    return (
      <div {...stylex.props(styles.root)}>
        <PageNavigation
          label={props.label}
          items={props.items.map((item) => ({ id: item.id, label: item.label, href: navigation.href(item.id) }))}
          selectedId={selected?.id ?? ''}
          onNavigate={navigation.onNavigate}
        />
        <div {...stylex.props(styles.panel)}>{selected?.content}</div>
      </div>
    );
  }

  return (
    <Tabs.Root value={selected?.id} onValueChange={(value) => setLocalId(String(value))} {...stylex.props(styles.root)}>
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
