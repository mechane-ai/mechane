import { Button, IconButton } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { PageToolbar, ToolbarAction } from '@mechane-ai/elements/layout';
import { Tooltip } from '@mechane-ai/elements/overlays';
import type { ConsoleData } from '@mechane/console-data';
import { MechList, MechsPagePlaceholder } from '@mechane/console-views';
import { Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearances } from '../mech-appearance.tsx';
import { useNavigationPreferences } from '../navigation-preferences.tsx';
import { useRecordNavigation } from '../navigation.tsx';
import { PageLoadNotice, usePageSource } from '../page-source.tsx';
import { ResourceView, useCollectionLifetime, useResource } from '../resource.tsx';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { CreateMechForm } from './create-mech.tsx';

export function MechsScreen({
  data,
  onOpen,
}: {
  readonly data: ConsoleData;
  readonly onOpen: (id: string) => void;
}): ReactNode {
  const { source, cursors, setCursors, pending, failure, cancel } = usePageSource({
    data,
    key: 'mechs',
    scope: data.workspace.id,
    create: (pages) => data.mechs(pages.at(-1) ?? null),
  });

  const records = useRecordNavigation();
  const appearances = useMechAppearances();
  const { pinned, togglePin } = useNavigationPreferences();
  const [isCreating, setCreating] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const isScreenActive = useScreenLifetime();

  const allowanceSource = useMemo(() => data.allowance(), [data]);
  const allowance = useResource(data, allowanceSource);
  const mechs = useResource(data, source);

  useCollectionLifetime(data, allowanceSource);

  const allowanceValue = allowance.kind === 'ready' ? allowance.value : undefined;

  const allowanceFailure =
    allowance.kind === 'failed'
      ? allowance
      : allowance.kind === 'ready' && allowance.refresh.kind === 'failed'
        ? allowance.refresh
        : undefined;

  const allowanceNotice =
    allowanceFailure === undefined ? null : (
      <Notice hasError>
        Workspace usage could not be refreshed.{' '}
        <Button isPending={allowanceFailure.isRetrying} pendingLabel="Retrying usage…" onClick={allowanceFailure.retry}>
          Retry usage
        </Button>
      </Notice>
    );

  async function refresh(): Promise<void> {
    if (isRefreshing) {
      return;
    }

    setRefreshing(true);
    await Promise.allSettled([data.refresh()]);

    if (isScreenActive()) {
      setRefreshing(false);
    }
  }

  if (isCreating) {
    return <CreateMechForm data={data} onCancel={() => setCreating(false)} onCreated={onOpen} />;
  }

  return (
    <ResourceView state={mechs} identity={source.id} placeholder={<MechsPagePlaceholder />} label="Loading mechs">
      {(page, notice) => (
        <>
          <PageToolbar
            title="Mechs"
            actions={
              <>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <IconButton
                        variant="ghost"
                        aria-label="Refresh mechs"
                        isPending={isRefreshing}
                        onClick={() => {
                          void refresh();
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
                <ToolbarAction
                  icon={<Plus size={16} aria-hidden />}
                  onClick={() => {
                    cancel();
                    setCreating(true);
                  }}
                >
                  Create mech
                </ToolbarAction>
              </>
            }
          />
          {notice}
          {allowanceNotice}
          <MechList
            page={page}
            allowance={allowanceValue}
            appearances={appearances}
            pinnedIds={new Set(pinned)}
            onTogglePin={(mech) => togglePin(mech.id)}
            mechHref={(mech) => records.href({ workspace: data.workspace.id, mech: mech.id })}
            onOpen={(mech) => records.open({ workspace: data.workspace.id, mech: mech.id }, mech.id)}
            focusRowId={records.focusRowId}
            onCreate={() => {
              cancel();
              setCreating(true);
            }}
            hasPrevious={cursors.length > 0}
            loadingPage={pending}
            pageNotice={failure === undefined ? undefined : <PageLoadNotice failure={failure} />}
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
    </ResourceView>
  );
}
