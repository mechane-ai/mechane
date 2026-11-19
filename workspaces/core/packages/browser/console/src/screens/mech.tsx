import { Button } from '@mechane-ai/elements';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { PageLayout, ToolbarAction, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { EvidencePagePlaceholder, MechPagePlaceholder } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { useRouterState } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechPageReads } from '../mech-page-reads.ts';
import type { MechPageReads } from '../mech-page-reads.ts';
import { readReaderPositions, restoreReaderPositions, useReaderPosition, useRecordNavigation } from '../navigation.tsx';
import { useMech } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ResourceState } from '../resource.tsx';
import type { ConsoleNavigation, ReaderPosition } from '../types.ts';
import { ActivityScreen } from './activity.tsx';
import { ArchiveScreen } from './archive.tsx';
import { EnvironmentScreen } from './environment.tsx';
import { EvidenceScreen } from './evidence.tsx';
import { selectedTraceTab, TraceScreen } from './trace.tsx';
import { TurnsScreen } from './turns.tsx';

type MechNavigation = ConsoleNavigation & { readonly data: ConsoleData; readonly mechId: string };

const diagnosticViews = [
  { id: 'runs', label: 'Runs' },
  { id: 'activity', label: 'Events' },
  { id: 'environment', label: 'Environment' },
  { id: 'conversation', label: 'Archive' },
] as const;

export function MechScreen({ data, mechId, location, navigate }: MechNavigation): ReactNode {
  const request = useMemo(() => data.reads.mech(mechId), [data, mechId]);
  const reads = useMechPageReads(data, mechId, location);
  const state = useMech(data, request);
  const [isOpen, setOpened] = useState(false);
  const records = useRecordNavigation();

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
        location.artifact === undefined ? (
          <MechPagePlaceholder
            view={reads.view}
            hasFocusedRun={location.turn !== undefined}
            traceTab={selectedTraceTab(location)}
          />
        ) : (
          <EvidencePagePlaceholder />
        )
      }
      label="Loading mech"
      failure={
        pageState.kind === 'failed' ? (
          <PageLayout
            title={location.turn === undefined ? 'Mech' : 'Run'}
            showNavigation={location.turn === undefined}
            leading={
              <ToolbarAction
                icon={<ArrowLeft size={16} aria-hidden />}
                aria-label={location.turn === undefined ? 'Back to agents' : 'Back to diagnostics'}
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
          >
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
          </PageLayout>
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
  const { view, page } = reads;
  const base = { workspace: data.workspace.id, mech: mech.id };
  const records = useRecordNavigation();
  const { consumeReturn } = records;
  const entry = useRouterState({ select: (state) => state.location.state });
  const positions = useRef(new Map<string, ReadonlyArray<ReaderPosition>>());
  const reader = useReaderPosition(data.scope, `${mech.id}:${view}`);
  const runReader = useReaderPosition(data.scope, `${mech.id}:run:${location.turn ?? ''}`);
  const runBack = useRef<HTMLButtonElement>(null);
  const isRun = location.turn !== undefined && location.artifact === undefined;
  const isPrimaryReady = reads.primary === undefined || reads.primary.kind === 'ready';
  const hasPage = page !== undefined;

  useLayoutEffect(() => {
    if (!hasPage || !isPrimaryReady) {
      return;
    }

    const target = entry.consoleReturn;
    const saved = reader.position === undefined ? [] : [reader.position];
    const previous = target?.positions ?? positions.current.get(view) ?? saved;

    const frame = requestAnimationFrame(() => {
      restoreReaderPositions(previous);

      if (target !== undefined) {
        positions.current.set(view, previous);
        consumeReturn();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [consumeReturn, isPrimaryReady, entry.consoleReturn, hasPage, view, reader.position]);

  useLayoutEffect(() => {
    if (isRun) {
      runBack.current?.focus({ preventScroll: true });
    }
  }, [isRun, location.turn]);

  if (location.artifact !== undefined) {
    return reads.evidence === undefined ? (
      <Notice hasError>This evidence ID is invalid.</Notice>
    ) : (
      <EvidenceScreen
        key={location.artifact}
        data={data}
        mechId={mech.id}
        mechName={mech.name}
        state={reads.evidence}
        notice={notice}
        location={location}
        navigate={navigate}
      />
    );
  }

  if (location.turn !== undefined) {
    return (
      <PageLayout
        showNavigation={false}
        title={mech.name}
        leading={
          <ToolbarAction
            ref={runBack}
            icon={<ArrowLeft size={16} aria-hidden />}
            aria-label="Back to diagnostics"
            onClick={() => records.back({ ...base, view })}
          >
            Back
          </ToolbarAction>
        }
      >
        <Workbench>
          <WorkbenchScroll label="Run details" scrollRestorationId={runReader.id}>
            {reads.trace === undefined ? (
              <Notice hasError>This run ID is invalid.</Notice>
            ) : (
              <TraceScreen
                view={view}
                key={location.turn}
                data={data}
                mech={mech}
                notice={notice}
                request={reads.trace}
                location={location}
                navigate={navigate}
              />
            )}
          </WorkbenchScroll>
        </Workbench>
      </PageLayout>
    );
  }

  function sectionContent(): ReactNode {
    if (page === undefined) {
      return null;
    }

    switch (page.view) {
      case 'conversation':
        return <ArchiveScreen data={data} mech={mech} pageRead={page.pageRead} />;
      case 'runs':
        return <TurnsScreen data={data} mech={mech} pageRead={page.pageRead} />;
      case 'activity':
        return <ActivityScreen data={data} mechId={mech.id} pageRead={page.pageRead} />;
      case 'environment':
        return <EnvironmentScreen data={data} request={page.request} isActive />;
    }
  }

  return (
    <PageLayout
      title={mech.name}
      navigation={{
        label: 'Diagnostics',
        selectedId: view,
        items: diagnosticViews.map((item) => ({ ...item, href: records.href({ ...base, view: item.id }) })),
        onNavigate: ({ id: next }) => {
          positions.current.set(view, readReaderPositions());
          navigate({ ...base, view: next });
        },
      }}
    >
      <Workbench>
        {notice}
        {view === 'conversation' ? (
          sectionContent()
        ) : (
          <WorkbenchScroll label="Diagnostics" scrollRestorationId={reader.id} isFlush={view !== 'environment'}>
            {sectionContent()}
          </WorkbenchScroll>
        )}
      </Workbench>
    </PageLayout>
  );
}
