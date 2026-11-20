import { CopyValue } from '@mechane-ai/elements';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { ConsoleData, ManagedSession, ReadRequest } from '@mechane/console-data';
import {
  EvidenceDetailsPlaceholder,
  ManagedEvidenceDetails,
  ManagedEvidenceList,
  ManagedEvidenceListPlaceholder,
  SessionPagination,
} from '@mechane/console-views';
import { consoleSessionEvidencePath, consoleSessionEvidenceViewerPath } from '@mechane/protocol';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ListPage } from '../list-page.tsx';
import { managedDestination } from '../managed-navigation.ts';
import { useManagedPaging } from '../managed-paging.ts';
import { useSessionArtifact, useSessionEvidence } from '../managed-reads.ts';
import { RouteLink, useReaderPosition } from '../navigation.tsx';
import { ResourceView } from '../resource.tsx';
import type { ResourceState } from '../resource.tsx';
import { sessionEvidenceRead } from '../session-evidence-read.ts';
import type { ConsoleLocation } from '../types.ts';

type SessionScope = { readonly agentId: string; readonly sessionId: string; readonly workspaceId: string };

type EvidenceScreenProps = {
  readonly data: ConsoleData;
  readonly read: ResourceState<ManagedSession>;
  readonly agentId: string;
  readonly sessionId: string;
  readonly location: ConsoleLocation;
};

export function ManagedSessionEvidence({ data, read, agentId, sessionId, location }: EvidenceScreenProps): ReactNode {
  const router = useRouter();
  const history = useRouterState({ select: (state) => state.location.state });
  const scope = { workspaceId: data.workspace.id, agentId, sessionId };

  const request = useMemo(() => sessionEvidenceRead({ agentId, sessionId }, location), [agentId, sessionId, location]);

  const isDetail = location.artifact !== undefined;
  const origin = history.sessionReaderOrigin;
  const back = isDetail ? history.sessionGalleryOrigin : origin?.selection;
  const steps = isDetail ? 1 : (origin?.steps ?? 0);
  const reader = useReaderPosition(data.scope, request?.id ?? 'missing-evidence');

  return (
    <ListPage
      kind="sessionEvidence"
      location={location}
      showQuery={!isDetail}
      showNavigation={!isDetail}
      title={read.kind === 'ready' ? `Evidence · ${read.value.title ?? read.value.agentName}` : 'Evidence'}
      leading={
        <RouteLink
          {...managedDestination({
            ...back,
            workspace: scope.workspaceId,
            agent: scope.agentId,
            session: scope.sessionId,
            ...(isDetail ? { isSessionEvidence: true } : {}),
          })}
          replace
          onClick={(event) => {
            const isCommand = event.metaKey || event.ctrlKey;
            const isModified = isCommand || event.shiftKey || event.altKey;

            if (back === undefined || event.button !== 0 || isModified) {
              return;
            }

            event.preventDefault();
            router.history.go(-steps);
          }}
          state={
            isDetail && history.sessionReaderOrigin !== undefined
              ? { sessionReaderOrigin: history.sessionReaderOrigin }
              : {}
          }
        >
          {isDetail ? 'Back to evidence' : 'Back to session'}
        </RouteLink>
      }
    >
      <ResourceView
        state={read}
        label="Loading session evidence"
        placeholder={isDetail ? <EvidenceDetailsPlaceholder /> : <ManagedEvidenceListPlaceholder />}
      >
        {(_session, notice) => (
          <Workbench>
            <WorkbenchScroll label="Session evidence" scrollRestorationId={reader.id}>
              {notice}
              {request === undefined ? (
                <EmptyState title="Evidence link unavailable" />
              ) : request.kind === 'sessionEvidence' ? (
                <SessionCaptures data={data} location={location} scope={scope} request={request} />
              ) : (
                <SessionCapture key={request.id} data={data} scope={scope} request={request} />
              )}
            </WorkbenchScroll>
          </Workbench>
        )}
      </ResourceView>
    </ListPage>
  );
}

function SessionCaptures({
  data,
  location,
  request,
  scope,
}: {
  readonly data: ConsoleData;
  readonly location: ConsoleLocation;
  readonly request: ReadRequest<'sessionEvidence'>;
  readonly scope: SessionScope;
}): ReactNode {
  const router = useRouter();
  const selectedRow = useRouterState({ select: (state) => state.location.state.sessionEvidenceReturn });
  const page = useSessionEvidence(data, request);
  const paging = useManagedPaging(location, scope.workspaceId);

  return (
    <ResourceView state={page} placeholder={<ManagedEvidenceListPlaceholder />} label="Loading session captures">
      {(value, notice) => (
        <>
          {notice}
          <ManagedEvidenceList
            artifacts={value.items}
            focusRowId={selectedRow}
            href={(artifactId) => consoleSessionEvidenceViewerPath({ ...scope, artifactId })}
            onOpen={(artifactId) => {
              globalThis.history.replaceState(
                { ...router.history.location.state, sessionEvidenceReturn: artifactId },
                '',
              );
              void router.navigate({
                to: '/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence/$artifactId',
                params: { ...scope, artifactId },
                state: (prior) => ({ ...prior, sessionGalleryOrigin: location }),
              });
            }}
          />
          <SessionPagination onPrevious={paging.previous} onNext={paging.next(value.next)} />
        </>
      )}
    </ResourceView>
  );
}

function SessionCapture({
  data,
  request,
  scope,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'sessionArtifact'>;
  readonly scope: SessionScope;
}): ReactNode {
  const state = useSessionArtifact(data, request);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [hasMediaFailed, setFailed] = useState(false);
  const path = { ...scope, artifactId: request.artifactId };

  return (
    <ResourceView state={state} placeholder={<EvidenceDetailsPlaceholder />} label="Loading capture">
      {(artifact, notice) => (
        <>
          {notice}
          <ManagedEvidenceDetails
            artifact={artifact}
            contentSrc={consoleSessionEvidencePath({ ...path, includeContent: true })}
            mediaAttempt={mediaAttempt}
            mediaFailure={hasMediaFailed ? 'unavailable' : undefined}
            onMediaError={() => {
              setFailed(true);
              void Promise.allSettled([data.refresh(request)]);
            }}
            onRetryMedia={() => {
              setFailed(false);
              setMediaAttempt((attempt) => attempt + 1);
              void Promise.allSettled([data.refresh(request)]);
            }}
          />
          <CopyValue
            label="evidence link"
            value={new URL(consoleSessionEvidenceViewerPath(path), globalThis.location.origin).href}
          >
            Copy link
          </CopyValue>
        </>
      )}
    </ResourceView>
  );
}
