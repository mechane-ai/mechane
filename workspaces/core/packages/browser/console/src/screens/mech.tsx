import { Heading, Muted, Row, Stack, Status } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { PageToolbar, ToolbarAction, Workbench, WorkbenchFooter, WorkbenchScroll } from '@mechane-ai/elements/layout';
import { PageNavigation } from '@mechane-ai/elements/navigation';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { MechStatus } from '@mechane/protocol';
import type { ConsoleView, Mech } from '@mechane/protocol';
import { useRouter } from '@tanstack/react-router';
import { Pause, Play, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { Resource } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { ActivityScreen } from './activity.tsx';
import { ConnectionsScreen } from './connections.tsx';
import { ConversationScreen } from './conversation.tsx';
import { EditMechForm } from './edit-mech.tsx';
import { MechSettings } from './mech-settings.tsx';
import { MessageForm } from './message.tsx';
import { TraceScreen } from './trace.tsx';
import { TurnsScreen } from './turns.tsx';
import { MemoryScreen, WorkScreen } from './work.tsx';

const sections: ReadonlyArray<{ readonly id: ConsoleView; readonly label: string }> = [
  { id: 'conversation', label: 'Conversation' },
  { id: 'work', label: 'Work' },
  { id: 'runs', label: 'Runs' },
  { id: 'memory', label: 'Memory' },
  { id: 'activity', label: 'History' },
];

type MechNavigation = ConsoleNavigation & { readonly data: ConsoleData; readonly mechId: string };

export function MechScreen({ data, mechId, location, navigate }: MechNavigation): ReactNode {
  const source = useMemo(() => data.mech(mechId), [data, mechId]);

  return (
    <Resource data={data} source={source} fallbackHeader={<PageToolbar title="Mech" />} label="Loading mech">
      {(mech, notice) => (
        <MechDetails data={data} mech={mech} notice={notice} location={location} navigate={navigate} />
      )}
    </Resource>
  );
}

function MechDetails({
  data,
  mech,
  location,
  navigate,
  notice,
}: Omit<MechNavigation, 'mechId'> & { readonly mech: Mech; readonly notice: ReactNode }): ReactNode {
  const router = useRouter();

  const view =
    sections.some((section) => section.id === location.view) || location.view === 'definition'
      ? location.view
      : 'conversation';

  const base = { workspace: data.workspace.id, mech: mech.id };
  const [editing, setEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MechStatus>();
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();
  const busy = pendingStatus !== undefined;

  function setStatus(status: MechStatus): void {
    if (busy) {
      return;
    }

    setPendingStatus(status);
    setError(undefined);
    void data.update(mech, { status }).then(
      () => {
        if (isScreenActive()) {
          setPendingStatus(undefined);
        }
      },
      (cause: unknown) => {
        if (isScreenActive()) {
          setPendingStatus(undefined);
          setError(problemMessage(cause));
        }
      },
    );
  }

  if (editing) {
    return <EditMechForm data={data} mech={mech} notice={notice} onClose={() => setEditing(false)} />;
  }

  const header = (
    <Stack compact>
      <Row between>
        <Row>
          <Heading compact>{mech.name}</Heading>
          <Status tone={mech.status === 'active' ? 'positive' : 'neutral'}>
            {mech.status === 'active' ? 'Enabled' : mech.status === 'paused' ? 'Paused' : 'Archived'}
          </Status>
        </Row>
        <Muted>{mech.model}</Muted>
      </Row>
      <PageNavigation
        embedded
        label="Mech sections"
        selectedId={view ?? 'conversation'}
        items={sections.map((section) => ({
          ...section,
          href: router.buildLocation({ to: '/', search: { ...base, view: section.id } }).publicHref,
        }))}
        onNavigate={(next) => navigate({ ...base, view: next })}
      />
    </Stack>
  );

  return (
    <>
      <PageToolbar
        breadcrumb
        title={
          <>
            <ConsoleLink to={{ workspace: data.workspace.id }}>Mechs</ConsoleLink> / {mech.name}
          </>
        }
        actions={
          <>
            {mech.status !== 'archived' && (
              <ToolbarAction
                icon={mech.status === 'active' ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
                disabled={busy}
                pending={busy}
                pendingLabel="Saving…"
                onClick={() => setStatus(mech.status === 'active' ? MechStatus.Paused : MechStatus.Active)}
              >
                {mech.status === 'active' ? 'Pause' : 'Resume'}
              </ToolbarAction>
            )}
            <ToolbarAction
              icon={<Settings size={16} aria-hidden />}
              onClick={() => navigate({ ...base, view: 'definition' })}
            >
              Settings
            </ToolbarAction>
          </>
        }
      />
      <Workbench
        header={header}
        inspector={
          location.turn === undefined ? undefined : (
            <TraceScreen
              key={location.turn}
              data={data}
              mech={mech}
              notice={null}
              turnId={location.turn}
              location={location}
              navigate={navigate}
            />
          )
        }
      >
        {notice}
        {error !== undefined && <Notice error>{error}</Notice>}
        {mech.status === 'paused' && (
          <Notice>Paused. New messages wait until you resume. A running execution may still finish.</Notice>
        )}
        {view === 'conversation' ? (
          <>
            <ConversationScreen data={data} mech={mech} />
            <WorkbenchFooter>
              <MessageForm data={data} mech={mech} />
            </WorkbenchFooter>
          </>
        ) : (
          <WorkbenchScroll>
            {view === 'runs' && (
              <TurnsScreen data={data} mech={mech} onMessage={() => navigate({ ...base, view: 'conversation' })} />
            )}
            {view === 'work' && <WorkScreen data={data} mech={mech} />}
            {view === 'memory' && <MemoryScreen data={data} mech={mech} />}
            {view === 'activity' && <ActivityScreen data={data} mechId={mech.id} />}
            {view === 'definition' && (
              <Stack>
                <MechSettings
                  mech={mech}
                  busy={busy}
                  error={error}
                  onEdit={() => setEditing(true)}
                  onArchive={() => setStatus(MechStatus.Archived)}
                />
                <ConnectionsScreen data={data} mechId={mech.id} />
              </Stack>
            )}
          </WorkbenchScroll>
        )}
      </Workbench>
    </>
  );
}
