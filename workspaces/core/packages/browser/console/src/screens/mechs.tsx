import { Button } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { PageToolbar, ToolbarAction } from '@mechane-ai/elements/layout';
import { Tooltip } from '@mechane-ai/elements/overlays';
import type { ConsoleData } from '@mechane/console-data';
import { MechList } from '@mechane/console-views';
import type { Allowance } from '@mechane/protocol';
import { Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearances } from '../mech-appearance.tsx';
import { usePageCursors, useRecordNavigation } from '../navigation.tsx';
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
  const records = useRecordNavigation();
  const appearances = useMechAppearances();
  const [creating, setCreating] = useState(false);
  const after = cursors.at(-1) ?? null;
  const source = useMemo(() => data.mechs(after), [data, after]);

  const allowanceSource = useMemo(() => data.allowance(), [data]);
  const allowance = useResource(data, allowanceSource);
  let allowanceValue: Allowance | undefined = undefined;
  let allowanceNotice: ReactNode = null;

  switch (allowance.kind) {
    case 'ready':
      allowanceValue = allowance.value;
      break;
    case 'failed':
    case 'stale':
      allowanceValue = allowance.kind === 'stale' ? allowance.value : undefined;

      allowanceNotice = (
        <Notice error>
          Workspace usage could not be refreshed. <Button onClick={allowance.retry}>Retry usage</Button>
        </Notice>
      );

      break;
    case 'pending':
      allowanceValue = undefined;
      break;
  }

  if (creating) {
    return <CreateMechForm data={data} onCancel={() => setCreating(false)} onCreated={onOpen} />;
  }

  return (
    <>
      <PageToolbar
        title="Mechs"
        actions={
          <>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <ToolbarAction
                    aria-label="Refresh mechs"
                    onClick={() => {
                      void data.refresh();
                    }}
                  />
                }
              >
                <RefreshCw size={16} aria-hidden />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>Refresh mechs</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
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
            {allowanceNotice}
            <MechList
              page={page}
              allowance={allowanceValue}
              appearances={appearances}
              mechHref={(mech) => records.href({ workspace: data.workspace.id, mech: mech.id })}
              onOpen={(mech) => records.open({ workspace: data.workspace.id, mech: mech.id }, mech.id)}
              focusRowId={records.focusRowId}
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
