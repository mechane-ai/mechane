import { Button } from '@mechane-ai/elements';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
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
import { MechHeader, MechPagePlaceholder, MechSettings } from '@mechane/console-views';
import { MechStatus } from '@mechane/protocol';
import type { ConsoleView, Mech } from '@mechane/protocol';
import { useRouterState } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from '../mech-appearance.tsx';
import { useMechPageReads } from '../mech-page-reads.ts';
import type { MechPageReads } from '../mech-page-reads.ts';
import { useNavigationPreferences } from '../navigation-preferences.tsx';
import { readReaderPositions, restoreReaderPositions, useRecordNavigation } from '../navigation.tsx';
import { ResourceView, useCollectionLifetime, useResource } from '../resource.tsx';
import type { ResourceState } from '../resource.tsx';
import type { ConsoleNavigation, ReaderPosition } from '../types.ts';
import { useMechNavigationResource } from '../use-mech-navigation-resource.ts';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { ActivityScreen } from './activity.tsx';
import { ConnectionsScreen } from './connections.tsx';
import { ConversationScreen } from './conversation.tsx';
import { EditMechForm } from './edit-mech.tsx';
import { MessageForm } from './message.tsx';
import { selectedTraceTab, TraceScreen } from './trace.tsx';
import { TurnsScreen } from './turns.tsx';
import { MemoryScreen, WorkScreen } from './work.tsx';

type MechNavigation = ConsoleNavigation & { readonly data: ConsoleData; readonly mechId: string };

const collectionViews: ReadonlySet<ConsoleView> = new Set(['runs', 'activity', 'work']);
const failedPrimaryStates: ReadonlySet<MechPageReads['status']> = new Set(['failed', 'failed-retrying']);

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
  const reads = useMechPageReads(data, mechId, location);
  const state = useResource(data, source);
  const [opened, setOpened] = useState(false);
  const records = useRecordNavigation();

  useCollectionLifetime(data, source);
  useMechNavigationResource({ source, mechId, shouldRecordVisit: true });

  const canOpen = state.kind === 'ready' && reads.status !== 'pending';

  if (!opened && canOpen) {
    setOpened(true);
  }

  let pageState: ResourceState<Mech> = state;

  const primaryFailed = failedPrimaryStates.has(reads.status);
  const canShowPrimaryFailure = !opened && state.kind !== 'failed';

  if (canShowPrimaryFailure && primaryFailed && reads.primary !== undefined) {
    const primary = reads.primary;
    const failure = primary.health.error ?? primary.health.failureReason;

    pageState = {
      kind: 'failed',
      problem: failure?.cause,
      retrying: reads.status === 'failed-retrying',
      retry: () => {
        const recovery = primary.health.error === null ? primary.utils.refetch() : primary.reload();

        void Promise.allSettled([recovery]);
      },
    };
  } else if (!opened && !canOpen && state.kind === 'ready') {
    pageState = { kind: 'pending' };
  }

  return (
    <ResourceView
      identity={source.id}
      state={pageState}
      placeholder={
        <MechPagePlaceholder
          view={reads.viewRead.view}
          focusedRun={location.turn !== undefined}
          traceTab={selectedTraceTab(location)}
        />
      }
      label="Loading mech"
      failure={
        pageState.kind === 'failed' ? (
          <>
            <PageToolbar
              title={location.turn === undefined ? 'Mech' : 'Run'}
              navigation={location.turn === undefined}
              leading={
                <ToolbarAction
                  icon={<ArrowLeft size={16} aria-hidden />}
                  aria-label={location.turn === undefined ? 'Back to mechs' : 'Back to mech'}
                  onClick={() => {
                    if (location.turn === undefined) {
                      navigate({ workspace: data.workspace.id });

                      return;
                    }

                    records.back({ workspace: data.workspace.id, mech: mechId });
                  }}
                >
                  Back
                </ToolbarAction>
              }
            />
            <Workbench>
              <WorkbenchScroll label="Loading failed">
                <div role="alert">
                  <EmptyState
                    title="Unable to load"
                    action={
                      <Button onClick={pageState.retry} pending={pageState.retrying} pendingLabel="Retrying…">
                        Try again
                      </Button>
                    }
                  >
                    {problemMessage(pageState.problem)}
                  </EmptyState>
                </div>
              </WorkbenchScroll>
            </Workbench>
          </>
        ) : undefined
      }
    >
      {(mech, notice) => (
        <MechDetails data={data} mech={mech} reads={reads} notice={notice} location={location} navigate={navigate} />
      )}
    </ResourceView>
  );
}

function MechDetails({
  data,
  mech,
  location,
  navigate,
  notice,
  reads,
}: Omit<MechNavigation, 'mechId'> & {
  readonly mech: Mech;
  readonly notice: ReactNode;
  readonly reads: MechPageReads;
}): ReactNode {
  const view = reads.viewRead.view;
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
    switch (reads.viewRead.view) {
      case 'runs':
        return (
          <TurnsScreen
            data={data}
            mech={mech}
            pageSource={reads.viewRead.pageSource}
            onMessage={() => selectView('conversation')}
          />
        );
      case 'work':
        return <WorkScreen data={data} pageSource={reads.viewRead.pageSource} />;
      case 'memory':
        return <MemoryScreen data={data} mech={mech} source={reads.viewRead.source} />;
      case 'activity':
        return <ActivityScreen data={data} mechId={mech.id} pageSource={reads.viewRead.pageSource} />;
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
              <ConversationScreen data={data} mech={mech} pageSource={reads.conversation} active={conversationActive} />
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
              {reads.trace === undefined ? (
                <Notice error>This run ID is invalid.</Notice>
              ) : (
                <TraceScreen
                  key={location.turn}
                  data={data}
                  mech={mech}
                  notice={notice}
                  turnId={location.turn}
                  source={reads.trace}
                  location={location}
                  navigate={navigate}
                />
              )}
            </WorkbenchScroll>
          </Workbench>
        </>
      )}
    </ViewStack.Root>
  );
}
