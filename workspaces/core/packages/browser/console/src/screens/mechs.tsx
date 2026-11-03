import type { ConsoleData } from '@mechane/console-data';
import { MechList } from '@mechane/console-views';
import { Notice, Toolbar, ToolbarAction } from '@mechane/ui';
import { Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink, usePageCursors } from '../navigation.tsx';
import { Resource, useResource } from '../resource.tsx';
import { CreateMechForm } from './create-mech.tsx';

export function MechsScreen({
  data,
  onOpen,
}: {
  readonly data: ConsoleData;
  readonly onOpen: (id: string) => void;
}): ReactNode {
  const [cursors, setCursors] = usePageCursors('mechs', []);
  const [creating, setCreating] = useState(false);
  const after = cursors.at(-1) ?? null;
  const source = useMemo(() => data.mechs(after), [data, after]);

  const allowanceSource = useMemo(() => data.allowance(), [data]);
  const allowance = useResource(data, allowanceSource);

  if (creating) {
    return <CreateMechForm data={data} onCancel={() => setCreating(false)} onCreated={onOpen} />;
  }

  return (
    <>
      <Toolbar
        title="Mechs"
        actions={
          <>
            <ToolbarAction
              aria-label="Refresh mechs"
              onClick={() => {
                void data.refresh();
              }}
            >
              <RefreshCw size={16} aria-hidden />
            </ToolbarAction>
            <ToolbarAction icon={<Plus size={16} aria-hidden />} onClick={() => setCreating(true)}>
              Create mech
            </ToolbarAction>
          </>
        }
      />
      <Resource data={data} source={source} label="Loading mechs">
        {(page, notice) => (
          <>
            {notice}
            {allowance.failed && <Notice error>Workspace usage could not be refreshed.</Notice>}
            <MechList
              page={page}
              allowance={allowance.value}
              nameLink={(mech) => (
                <ConsoleLink
                  to={{ workspace: data.workspace.id, mech: mech.id }}
                  row={mech.id}
                  title={`${mech.name} · ${mech.id}`}
                >
                  {mech.name}
                </ConsoleLink>
              )}
              onCreate={() => setCreating(true)}
              hasPrevious={cursors.length > 0}
              onPrevious={() => setCursors(cursors.slice(0, -1))}
              onNext={() => {
                const last = page.mechs.at(-1);

                if (last !== undefined) {
                  setCursors([...cursors, last.id]);
                }
              }}
            />
          </>
        )}
      </Resource>
    </>
  );
}
