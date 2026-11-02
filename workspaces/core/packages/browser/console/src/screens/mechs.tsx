import type { ConsoleData } from '@mechane/console-data';
import { MechList } from '@mechane/console-views';
import { Notice, Stack } from '@mechane/ui';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Resource, useResource } from '../resource.tsx';
import { CreateMechForm } from './create-mech.tsx';

export function MechsScreen({
  data,
  onOpen,
}: {
  readonly data: ConsoleData;
  readonly onOpen: (id: string) => void;
}): ReactNode {
  const [cursors, setCursors] = useState<ReadonlyArray<string>>([]);
  const [creating, setCreating] = useState(false);
  const after = cursors.at(-1) ?? null;
  const source = useMemo(() => data.mechs(after), [data, after]);

  const allowanceSource = useMemo(() => data.allowance(), [data]);
  const allowance = useResource(data, allowanceSource);

  if (creating) {
    return <CreateMechForm data={data} onCancel={() => setCreating(false)} onCreated={onOpen} />;
  }

  return (
    <Resource data={data} source={source}>
      {(page) => (
        <Stack>
          {allowance.failed && <Notice error>Workspace usage could not be refreshed.</Notice>}
          <MechList
            page={page}
            allowance={allowance.value}
            onOpen={(mech) => onOpen(mech.id)}
            onCreate={() => setCreating(true)}
            hasPrevious={cursors.length > 0}
            onPrevious={() => setCursors((previous) => previous.slice(0, -1))}
            onNext={() => {
              const last = page.mechs.at(-1);

              if (last !== undefined) {
                setCursors((previous) => [...previous, last.id]);
              }
            }}
            onRefresh={() => {
              void data.refresh();
            }}
          />
        </Stack>
      )}
    </Resource>
  );
}
