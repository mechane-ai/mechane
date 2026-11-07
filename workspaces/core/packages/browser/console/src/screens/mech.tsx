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
import { useWorkspaceDrafts } from '../drafts.tsx';
import { useMechAppearance } from '../mech-appearance.tsx';
import { useMechPageReads } from '../mech-page-reads.ts';
import type { MechPageReads } from '../mech-page-reads.ts';
import { useNavigationPreferences } from '../navigation-preferences.tsx';
import { readReaderPositions, restoreReaderPositions, useReaderPosition, useRecordNavigation } from '../navigation.tsx';
import { useMech } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
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

const viewLabels: Readonly<Partial<Record<ConsoleView, string>>> = {
  conversation: 'Conversation',
  work: 'Work',
  runs: 'Runs',
  memory: 'Memory',
  activity: 'History',
  definition: 'Mech settings',
};

export function MechScreen({ data, mechId, location, navigate }: MechNavigation): ReactNode {
  const request = useMemo(() => data.reads.mech(mechId), [data, mechId]);
  const reads = useMechPageReads(data, mechId, location);
  const state = useMech(data, request);
  const [isOpen, setOpened] = useState(false);
  const records = useRecordNavigation();

  useMechNavigationResource({ state, mechId, shouldRecordVisit: true });

  const hasPrimary = reads.primary === undefined || reads.primary.kind === 'ready';
  const canOpen = state.kind === 'ready' && hasPrimary;

  if (!isOpen && canOpen) {
    setOpened(true);
  }

  let pageState: ResourceState<Mech> = state;

  const canShowPrimaryFailure = !isOpen && state.kind !== 'failed';

  if (canShowPrimaryFailure && reads.primary?.kind === 'failed') {
    pageState = reads.primary;
  } else if (!isOpen && !canOpen && state.kind === 'ready') {
    pageState = { kind: 'pending' };
  }

  return (
    <ResourceView
      state={pageState}
      placeholder={
        <MechPagePlaceholder
          view={reads.viewRead.view}
          hasFocusedRun={location.turn !== undefined}
          traceTab={selectedTraceTab(location)}
        />
      }
      label="Loading mech"
      failure={
        pageState.kind === 'failed' ? (
          <>
            <PageToolbar
              title={location.turn === undefined ? 'Mech' : 'Run'}
              showNavigation={location.turn === undefined}
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
                      <Button onClick={pageState.retry} isPending={pageState.isRetrying} pendingLabel="Retrying…">
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

  const base = {
    workspace: data.workspace.id,
    mech: mech.id,
    ...(location.session === undefined ? {} : { session: location.session }),
  };

  const drafts = useWorkspaceDrafts();
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
  const reader = useReaderPosition(data.scope, `${mech.id}:${view}`);
  const runReader = useReaderPosition(data.scope, `${mech.id}:run:${location.turn ?? ''}`);
  const runBack = useRef<HTMLButtonElement>(null);
  const isBusy = pendingStatus !== undefined;
  const hasFocusedRun = location.turn !== undefined;
  const isEditing = drafts.definition !== undefined && view === 'definition' && !hasFocusedRun;
  const previousRun = useRef(hasFocusedRun);
  const isConversationVisible = view === 'conversation';
  const isConversationActive = isConversationVisible && !hasFocusedRun && !isEditing;
  const isPrimaryReady = reads.primary === undefined || reads.primary.kind === 'ready';
  const archiveError = statusError?.status === MechStatus.Archived ? statusError.message : undefined;
  const lifecycleError = statusError?.status === MechStatus.Archived ? undefined : statusError?.message;

  if (isConversationVisible && !hasFocusedRun && !conversationVisited) {
    setConversationVisited(true);
  }

  useLayoutEffect(() => {
    if (hasFocusedRun || isEditing || !isPrimaryReady) {
      return;
    }

    const target = entry.consoleReturn;
    const saved = reader.position === undefined ? [] : [reader.position];
    const positions = target?.positions ?? readerPositions.current.get(view) ?? saved;

    const frame = requestAnimationFrame(() => {
      restoreReaderPositions(positions);

      if (target !== undefined) {
        readerPositions.current.set(view, positions);
        consumeReturn();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [consumeReturn, isEditing, isPrimaryReady, entry.consoleReturn, hasFocusedRun, view, reader.position]);

  useLayoutEffect(() => {
    const isEnteringRun = hasFocusedRun && !previousRun.current;

    previousRun.current = hasFocusedRun;

    if (isEnteringRun) {
      runBack.current?.focus({ preventScroll: true });
    }
  }, [hasFocusedRun]);

  function selectView(next: ConsoleView): void {
    readerPositions.current.set(view, readReaderPositions());
    navigate({ ...base, view: next });
  }

  function setStatus(status: MechStatus): void {
    if (isBusy) {
      return;
    }

    setPendingStatus(status);
    setStatusError(undefined);
    void data.commands.updateMech({ mechId: mech.id, expectedRevision: mech.revision, status }).then(
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
            pageRead={reads.viewRead.pageRead}
            sessionId={location.session}
            onMessage={() => selectView('conversation')}
          />
        );
      case 'work':
        return <WorkScreen data={data} pageRead={reads.viewRead.pageRead} />;
      case 'memory':
        return <MemoryScreen data={data} mech={mech} request={reads.viewRead.request} />;
      case 'activity':
        return <ActivityScreen data={data} mechId={mech.id} pageRead={reads.viewRead.pageRead} />;
      case 'definition':
        return (
          <MechSettings
            mech={mech}
            isBusy={isBusy}
            error={archiveError}
            connections={<ConnectionsScreen data={data} mechId={mech.id} />}
            appearance={appearance}
            onAppearance={setAppearance}
            appearanceError={appearanceError}
            onEdit={() => {
              readerPositions.current.set(view, readReaderPositions());
              drafts.openDefinition(mech);
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
      <ViewStack.Panel isActive={!hasFocusedRun && !isEditing}>
        <MechHeader
          mech={mech}
          appearance={appearance}
          view={view}
          isPinned={preferences.pinned.includes(mech.id)}
          isBusy={isBusy}
          viewHref={(next) => records.href({ ...base, view: next })}
          onView={selectView}
          onPin={() => preferences.togglePin(mech.id)}
          onStatus={() => setStatus(mech.status === 'active' ? MechStatus.Paused : MechStatus.Active)}
        />
        <Workbench>
          {notice}
          {lifecycleError !== undefined && <Notice hasError>{lifecycleError}</Notice>}
          {mech.status === 'paused' && (
            <Notice>Paused. New messages wait until you resume. A running execution may still finish.</Notice>
          )}
          {conversationVisited && (
            <ViewStack.Panel isActive={isConversationVisible}>
              <ConversationScreen
                data={data}
                mech={mech}
                entry={reads.conversation}
                isActive={isConversationActive}
                onSession={(session) =>
                  navigate({
                    workspace: data.workspace.id,
                    mech: mech.id,
                    ...(session === undefined ? {} : { session }),
                    view: 'conversation',
                  })
                }
              />
              <WorkbenchFooter>
                <MessageForm
                  data={data}
                  mech={mech}
                  entry={reads.conversation}
                  onSession={(session) =>
                    navigate({ workspace: data.workspace.id, mech: mech.id, session, view: 'conversation' })
                  }
                />
              </WorkbenchFooter>
            </ViewStack.Panel>
          )}
          {!isConversationVisible && (
            <WorkbenchScroll label={viewLabel} scrollRestorationId={reader.id} isFlush={collectionViews.has(view)}>
              {sectionContent()}
            </WorkbenchScroll>
          )}
        </Workbench>
      </ViewStack.Panel>
      {isEditing && <EditMechForm data={data} mech={mech} notice={notice} onClose={drafts.closeDefinition} />}
      {location.turn !== undefined && (
        <>
          <PageToolbar
            showNavigation={false}
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
            <WorkbenchScroll label="Run details" scrollRestorationId={runReader.id}>
              {reads.trace === undefined ? (
                <Notice hasError>This run ID is invalid.</Notice>
              ) : (
                <TraceScreen
                  key={location.turn}
                  data={data}
                  mech={mech}
                  notice={notice}
                  turnId={location.turn}
                  request={reads.trace}
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
