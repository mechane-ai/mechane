import { Status, TextButton } from '@mechane-ai/elements';
import { Notice, Skeleton } from '@mechane-ai/elements/feedback';
import { PageLayout, ToolbarAction, Workbench, WorkbenchFooter } from '@mechane-ai/elements/layout';
import type { ConsoleData, ManagedSession } from '@mechane/console-data';
import {
  ConversationPlaceholder,
  SessionComposer,
  SessionPagination,
  SessionStatus,
  SessionThreadPicker,
  SessionTranscript,
} from '@mechane/console-views';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useWorkspaceDrafts } from '../drafts.tsx';
import { useManagedCommand } from '../managed-command.ts';
import { managedDestination } from '../managed-navigation.ts';
import { useManagedPaging } from '../managed-paging.ts';
import { useManagedSession, useManagedThreads } from '../managed-reads.ts';
import { RouteLink, useReaderPosition } from '../navigation.tsx';
import { useAgentAttention, useManagedEvents } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';
import { ArchiveManagedResource } from './archive-managed-resource.tsx';
import { ManagedSessionEvidence } from './managed-evidence.tsx';

const interruptibleStatuses: ReadonlySet<ManagedSession['status']> = new Set(['running', 'rescheduling']);

type SessionScreenProps = ConsoleNavigation & {
  readonly agentId: string;
  readonly data: ConsoleData;
  readonly sessionId: string;
};

export function ManagedSessionScreen(props: SessionScreenProps): ReactNode {
  const { data, agentId, sessionId, navigate } = props;
  const workspace = data.workspace.id;
  const request = useMemo(() => data.reads.session(agentId, sessionId), [data, agentId, sessionId]);
  const read = useManagedSession(data, request);
  const session = read.kind === 'ready' ? read.value : undefined;

  if (props.location.isSessionEvidence === true) {
    return (
      <ManagedSessionEvidence
        data={data}
        read={read}
        agentId={agentId}
        sessionId={sessionId}
        location={props.location}
      />
    );
  }

  const agentName = session?.agentName ?? 'Agent';

  return (
    <PageLayout
      title={session?.title ?? session?.agentName ?? 'Session'}
      leading={
        <ToolbarAction
          aria-label={`Back to ${agentName} sessions`}
          icon={<ArrowLeft size={16} aria-hidden />}
          onClick={() => navigate({ workspace, agent: agentId })}
        >
          {agentName}
        </ToolbarAction>
      }
      actions={session !== undefined && <SessionActions {...props} session={session} />}
    >
      <ResourceView state={read} label="Loading session" placeholder={<ConversationPlaceholder />}>
        {(value, notice) => (
          <>
            {notice}
            <SessionDetail {...props} session={value} />
          </>
        )}
      </ResourceView>
    </PageLayout>
  );
}

function SessionActions({
  data,
  agentId,
  sessionId,
  session,
  location,
  navigate,
}: SessionScreenProps & { readonly session: ManagedSession }): ReactNode {
  const workspace = data.workspace.id;
  const target = { agentId, sessionId };
  const attention = useAgentAttention(data, agentId);
  const activeSessionId = attention?.sessionId;
  const isHistoric = location.through !== undefined;
  const isArchived = typeof session.archivedAt === 'string';
  const isCurrentSession = location.thread === undefined && !isHistoric;
  const canArchive = isCurrentSession && session.archivedAt === null && session.status === 'idle';
  const stop = useSessionStop(data, agentId, session);

  return (
    <>
      <RouteLink
        to="/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence"
        params={{ workspaceId: workspace, agentId, sessionId }}
        state={{ sessionReaderOrigin: { selection: location, steps: 1 } }}
      >
        Evidence
      </RouteLink>
      {isHistoric && (
        <TextButton onClick={() => navigate({ workspace, agent: agentId, session: sessionId })}>
          Latest events
        </TextButton>
      )}
      {typeof activeSessionId === 'string' && activeSessionId !== sessionId && (
        <TextButton onClick={() => navigate({ workspace, agent: agentId, session: activeSessionId })}>
          Agent working in another session
        </TextButton>
      )}
      {canArchive && (
        <ArchiveManagedResource
          kind="session"
          name={session.title ?? sessionId}
          archive={() => data.managed.archiveSession(target)}
        />
      )}
      {isArchived ? (
        <Status>Archived</Status>
      ) : (
        <SessionStatus
          status={session.status}
          stopReason={stop?.stopReason}
          isExecuting={activeSessionId === sessionId}
          isWaiting={attention?.queuedSessionIds.includes(sessionId)}
        />
      )}
    </>
  );
}

function useSessionStop(data: ConsoleData, agentId: string, session: ManagedSession) {
  const latest = useMemo(() => data.reads.sessionStatus(agentId, session.id), [data, agentId, session.id]);
  const authority = useManagedEvents(data, latest);

  const status =
    authority.kind === 'ready' && authority.refresh.kind !== 'failed' ? authority.value.items[0] : undefined;

  return session.status === 'idle' && status?.type === 'session.status_idle' ? status : undefined;
}

function SessionDetail({
  data,
  agentId,
  sessionId,
  session,
  location,
  navigate,
}: SessionScreenProps & { readonly session: ManagedSession }): ReactNode {
  const router = useRouter();
  const workspace = data.workspace.id;
  const target = { agentId, sessionId };
  const command = useManagedCommand();
  const draft = useWorkspaceDrafts();
  const paging = useManagedPaging(location, workspace);

  const request = useMemo(
    () =>
      data.reads.sessionEvents(
        { agentId, sessionId, threadId: location.thread ?? null },
        location.page ?? null,
        location.through,
      ),
    [data, agentId, sessionId, location.thread, location.page, location.through],
  );

  const reader = useReaderPosition(data.scope, request.id);
  const events = useManagedEvents(data, request);
  const [threadPages, setThreadPages] = useState<ReadonlyArray<string>>([]);
  const threadCursor = threadPages.at(-1) ?? null;

  const threadRequest = useMemo(
    () => data.reads.threads(agentId, sessionId, threadCursor),
    [data, agentId, sessionId, threadCursor],
  );

  const threads = useManagedThreads(data, threadRequest);
  const canSend = session.status !== 'terminated';
  const isPrimary = location.thread === undefined;
  const isHistoric = location.through !== undefined;
  const isArchived = typeof session.archivedAt === 'string';
  const canCompose = isPrimary && !isHistoric && !isArchived;

  const stop = useSessionStop(data, agentId, session);
  const awaiting = new Set(stop?.pendingEventIds);

  for (const event of events.kind === 'ready' ? events.value.items : []) {
    if (
      event.relatedEventId !== null &&
      (event.type === 'user.tool_confirmation' || event.type.endsWith('tool_result'))
    ) {
      awaiting.delete(event.relatedEventId);
    }
  }

  useEffect(() => {
    if (isHistoric || isArchived) {
      return;
    }

    const controller = new AbortController();

    // Losing the stream leaves the normal read observer responsible for polling and error notices.
    void data.managed.followEvents(request, controller.signal).catch(() => undefined);

    return () => controller.abort();
  }, [data, request, isHistoric, isArchived]);

  function selectThread(thread: string | undefined): void {
    navigate({ workspace, agent: agentId, session: sessionId, ...(thread === undefined ? {} : { thread }) });
  }

  return (
    <Workbench>
      <ResourceView state={threads} label="Loading session threads" placeholder={<Skeleton width={120} />}>
        {(page, notice) => (
          <>
            {notice}
            <SessionThreadPicker threads={page.items} threadId={location.thread} onSelect={selectThread} />
            <SessionPagination
              onPrevious={threadPages.length > 0 ? () => setThreadPages(threadPages.slice(0, -1)) : undefined}
              onNext={
                page.next === null
                  ? undefined
                  : () => {
                      if (page.next !== null) {
                        setThreadPages([...threadPages, page.next]);
                      }
                    }
              }
            />
          </>
        )}
      </ResourceView>
      <ResourceView state={events} label="Loading conversation" placeholder={<ConversationPlaceholder />}>
        {(page, notice) => (
          <>
            {notice}
            <SessionTranscript
              events={page.items.toReversed()}
              agentName={session.agentName}
              reader={reader}
              threadId={location.thread}
              onOpenThread={selectThread}
              eventHref={(eventId, through) =>
                new URL(
                  router.buildLocation(
                    managedDestination({ workspace, agent: agentId, session: sessionId, eventId, through }),
                  ).publicHref,
                  globalThis.location.origin,
                ).href
              }
              selectedEventId={location.eventId}
              pendingApprovalIds={isHistoric ? undefined : awaiting}
              confirmingEventId={command.pending}
              onConfirm={(id, allow) =>
                command.run(id, () =>
                  data.managed.confirmTool({ ...target, toolUseId: id, result: allow ? 'allow' : 'deny' }),
                )
              }
              controls={<SessionPagination onPrevious={paging.previous} onNext={paging.next(page.next)} />}
            />
          </>
        )}
      </ResourceView>
      {command.error !== undefined && <Notice hasError>{command.error}</Notice>}
      {canCompose && (
        <WorkbenchFooter>
          <SessionComposer
            value={draft.message.text}
            onChange={draft.changeMessage}
            onSend={() => draft.sendMessage(canSend, ({ text }) => data.managed.sendMessage({ ...target, text }))}
            isPending={draft.message.submission?.isPending === true}
            isDisabled={!canSend}
            error={draft.message.submission?.error}
            onInterrupt={
              interruptibleStatuses.has(session.status)
                ? () => command.run('interrupt', () => data.managed.interrupt(target))
                : undefined
            }
            isInterruptPending={command.pending === 'interrupt'}
          />
        </WorkbenchFooter>
      )}
    </Workbench>
  );
}
