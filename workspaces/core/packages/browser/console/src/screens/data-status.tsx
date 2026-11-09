import { Collapsible, Muted, Stack } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import type { ConsoleData } from '@mechane/console-data';
import { useCallback, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export function DataStatus({ data }: { readonly data: ConsoleData }): ReactNode {
  const counts = useSyncExternalStore(data.diagnostics.subscribe, data.diagnostics.read);
  const subscribe = useCallback((notify: () => void) => data.subscribeHealth(notify), [data]);
  const read = useCallback(() => data.readHealth(), [data]);
  const health = useSyncExternalStore(subscribe, read);

  return (
    <Collapsible.Root>
      <Collapsible.Trigger>Data status</Collapsible.Trigger>
      <Collapsible.Panel>
        <Stack isCompact>
          <Details
            items={[
              {
                label: 'Storage',
                value:
                  health.issue?.message ?? (health.isDisposed ? 'Storage owner closed' : 'wa-sqlite / OPFS available'),
              },
              { label: 'Scope', value: 'Current admitted account and workspace' },
              { label: 'Active reads', value: counts.active },
              { label: 'Refreshing', value: counts.refreshing },
              { label: 'Failed reads', value: counts.failed },
            ]}
          />
          <Muted>HTTP read activity belongs to this tab.</Muted>
          <Muted>
            Retry failed reads from the affected view. Storage recovery rechecks access and keeps your drafts.
          </Muted>
        </Stack>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
