import { Notice } from '@mechane-ai/elements/feedback';
import {
  PageToolbar,
  ToolbarAction,
  ViewStack,
  Workbench,
  WorkbenchFooter,
  WorkbenchScroll,
} from '@mechane-ai/elements/layout';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { MechHeader, MechSettings } from '@mechane/console-views';
import { MechStatus } from '@mechane/protocol';
import type { ConsoleView, Mech } from '@mechane/protocol';
import { useRouterState } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from '../mech-appearance.tsx';
import { useNavigationPreferences } from '../navigation-preferences.tsx';
import { readReaderPositions, restoreReaderPositions, useRecordNavigation } from '../navigation.tsx';
import { Resource } from '../resource.tsx';
import type { ConsoleNavigation, ReaderPosition } from '../types.ts';
import { useMechNavigationResource } from '../use-mech-navigation-resource.ts';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { ActivityScreen } from './activity.tsx';
import { ConnectionsScreen } from './connections.tsx';
import { ConversationScreen } from './conversation.tsx';
import { EditMechForm } from './edit-mech.tsx';
import { MessageForm } from './message.tsx';
import { TraceScreen } from './trace.tsx';
import { TurnsScreen } from './turns.tsx';
import { MemoryScreen, WorkScreen } from './work.tsx';

type MechNavigation = ConsoleNavigation & { readonly data: ConsoleData; readonly mechId: string };

const mechViews: ReadonlySet<ConsoleView> = new Set([
  'conversation',
  'work',
  'runs',
  'memory',
  'activity',
  'definition',
]);

const collectionViews: ReadonlySet<ConsoleView> = new Set(['runs', 'activity', 'work']);

const viewLabels: Readonly<Partial<Record<ConsoleView, string>>> = {
  conversation: 'Conversation',
  work: 'Work',
  runs: 'Runs',
  memory: 'Memory',
  activity: 'History',
  definition: 'Mech settings',
};

export function MechScreen({ data, mechId, location, navigate }: MechNavigation): ReactNode {
  const source = useMemo(() => data.mech(mechId), [data, mechId]);

  useMechNavigationResource({ source, mechId, shouldRecordVisit: true });

  return (
    <Resource
      data={data}
      source={source}
      fallbackHeader={<PageToolbar title="Mech" navigation={location.turn === undefined} />}
      label="Loading mech"
    >
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
  const requestedView = location.view ?? 'conversation';
  const view = mechViews.has(requestedView) ? requestedView : 'conversation';
  const viewLabel = viewLabels[view] ?? 'Conversation';

  const base = { workspace: data.workspace.id, mech: mech.id };
  const [editing, setEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MechStatus>();
  const [statusError, setStatusError] = useState<{ readonly status: MechStatus; readonly message: string }>();

  const [conversationVisited, setConversationVisited] = useState(
    view === 'conversation' && location.turn === undefined,
  );

  const isScreenActive = useScreenLifetime();
  const preferences = useNavigationPreferences();
  const { appearance, setAppearance, persistenceError: appearanceError } = useMechAppearance(mech.id);
  const records = useRecordNavigation();
  const { consumeReturn } = records;
  const entry = useRouterState({ select: (state) => state.location.state });
  const readerPositions = useRef(new Map<ConsoleView, ReadonlyArray<ReaderPosition>>());
  const runBack = useRef<HTMLButtonElement>(null);
  const busy = pendingStatus !== undefined;
  const focusedRun = location.turn !== undefined;
  const previousRun = useRef(focusedRun);
  const conversationVisible = view === 'conversation';
  const conversationActive = conversationVisible && !focusedRun && !editing;
  const archiveError = statusError?.status === MechStatus.Archived ? statusError.message : undefined;
  const lifecycleError = statusError?.status === MechStatus.Archived ? undefined : statusError?.message;

  if (conversationVisible && !focusedRun && !conversationVisited) {
    setConversationVisited(true);
  }

  if (editing && (view !== 'definition' || focusedRun)) {
    setEditing(false);
  }

  useLayoutEffect(() => {
    if (focusedRun || editing) {
      return;
    }

    const target = entry.consoleReturn;
    const positions = target?.positions ?? readerPositions.current.get(view) ?? [];

    const frame = requestAnimationFrame(() => {
      restoreReaderPositions(positions);

      if (target !== undefined) {
        readerPositions.current.set(view, positions);
        consumeReturn();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [consumeReturn, editing, entry.consoleReturn, focusedRun, view]);

  useLayoutEffect(() => {
    const enteringRun = focusedRun && !previousRun.current;

    previousRun.current = focusedRun;

    if (enteringRun) {
      runBack.current?.focus({ preventScroll: true });
    }
  }, [focusedRun]);

  function selectView(next: ConsoleView): void {
    readerPositions.current.set(view, readReaderPositions());
    navigate({ ...base, view: next });
  }

  function setStatus(status: MechStatus): void {
    if (busy) {
      return;
    }

    setPendingStatus(status);
    setStatusError(undefined);
    void data.update(mech, { status }).then(
      () => {
        if (isScreenActive()) {
          setPendingStatus(undefined);
        }
      },
      (cause: unknown) => {
        if (isScreenActive()) {
          setPendingStatus(undefined);
          setStatusError({ status, message: problemMessage(cause) });
        }
      },
    );
  }

  function sectionContent(): ReactNode {
    switch (view) {
      case 'runs':
        return <TurnsScreen data={data} mech={mech} onMessage={() => selectView('conversation')} />;
      case 'work':
        return <WorkScreen data={data} mech={mech} />;
      case 'memory':
        return <MemoryScreen data={data} mech={mech} />;
      case 'activity':
        return <ActivityScreen data={data} mechId={mech.id} />;
      case 'definition':
        return (
          <MechSettings
            mech={mech}
            busy={busy}
            error={archiveError}
            connections={<ConnectionsScreen data={data} mechId={mech.id} />}
            appearance={appearance}
            onAppearance={setAppearance}
            appearanceError={appearanceError}
            onEdit={() => {
              readerPositions.current.set(view, readReaderPositions());
              setEditing(true);
            }}
            onArchive={() => setStatus(MechStatus.Archived)}
          />
        );
      case 'conversation':
      case 'events':
      case 'requests':
      case 'tools':
        return null;
    }
  }

  return (
    <ViewStack.Root>
      <ViewStack.Panel active={!focusedRun && !editing}>
        <MechHeader
          mech={mech}
          appearance={appearance}
          view={view}
          pinned={preferences.pinned.includes(mech.id)}
          busy={busy}
          viewHref={(next) => records.href({ ...base, view: next })}
          onView={selectView}
          onPin={() => preferences.togglePin(mech.id)}
          onStatus={() => setStatus(mech.status === 'active' ? MechStatus.Paused : MechStatus.Active)}
        />
        <Workbench>
          {notice}
          {lifecycleError !== undefined && <Notice error>{lifecycleError}</Notice>}
          {mech.status === 'paused' && (
            <Notice>Paused. New messages wait until you resume. A running execution may still finish.</Notice>
          )}
          {conversationVisited && (
            <ViewStack.Panel active={conversationVisible}>
              <ConversationScreen data={data} mech={mech} active={conversationActive} />
              <WorkbenchFooter>
                <MessageForm data={data} mech={mech} />
              </WorkbenchFooter>
            </ViewStack.Panel>
          )}
          {!conversationVisible && (
            <WorkbenchScroll label={viewLabel} scrollRestorationId={`mech-${view}`} flush={collectionViews.has(view)}>
              {sectionContent()}
            </WorkbenchScroll>
          )}
        </Workbench>
      </ViewStack.Panel>
      {editing && <EditMechForm data={data} mech={mech} notice={notice} onClose={() => setEditing(false)} />}
      {location.turn !== undefined && (
        <>
          <PageToolbar
            navigation={false}
            title={mech.name}
            leading={
              <ToolbarAction
                ref={runBack}
                icon={<ArrowLeft size={16} aria-hidden />}
                aria-label={`Back to ${viewLabel.toLowerCase()}`}
                onClick={() => records.back({ ...base, view })}
              >
                Back
              </ToolbarAction>
            }
          />
          <Workbench>
            <WorkbenchScroll label="Run details" scrollRestorationId="run">
              <TraceScreen
                key={location.turn}
                data={data}
                mech={mech}
                notice={notice}
                turnId={location.turn}
                location={location}
                navigate={navigate}
              />
            </WorkbenchScroll>
          </Workbench>
        </>
      )}
    </ViewStack.Root>
  );
}
