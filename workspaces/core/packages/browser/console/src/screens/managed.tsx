import { Status } from '@mechane-ai/elements';
import { Skeleton } from '@mechane-ai/elements/feedback';
import { ToolbarAction, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { ConsoleData, ManagedAgent } from '@mechane/console-data';
import {
  CreateEnvironmentForm,
  ManagedAgentList,
  ManagedListPlaceholder,
  ManagedSessionList,
  MechPinButton,
  SessionPagination,
  StartAgentForm,
  StartSessionForm,
} from '@mechane/console-views';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ListPage } from '../list-page.tsx';
import { useManagedCommand } from '../managed-command.ts';
import { managedDestination } from '../managed-navigation.ts';
import { useManagedPaging } from '../managed-paging.ts';
import { useManagedAgent, useManagedAgents, useManagedEnvironments, useManagedSessions } from '../managed-reads.ts';
import { useNavigationPreferences } from '../navigation-preferences.tsx';
import { useAgentAttention } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';
import { ArchiveManagedResource } from './archive-managed-resource.tsx';
import { ManagedSessionScreen } from './managed-session.tsx';

type ManagedProps = ConsoleNavigation & { readonly data: ConsoleData };

export function ManagedScreen(props: ManagedProps): ReactNode {
  if (props.location.agent === undefined) {
    return <AgentDirectory {...props} />;
  }

  if (props.location.session !== undefined) {
    return <ManagedSessionScreen {...props} agentId={props.location.agent} sessionId={props.location.session} />;
  }

  return <AgentScreen {...props} agentId={props.location.agent} />;
}

function AgentDirectory({ data, location, navigate }: ManagedProps): ReactNode {
  const router = useRouter();
  const [isCreating, setCreating] = useState(false);
  const command = useManagedCommand();
  const request = useMemo(() => data.reads.agents(location.page ?? null, location), [data, location]);
  const agents = useManagedAgents(data, request);
  const workspace = data.workspace.id;
  const paging = useManagedPaging(location, workspace);

  function open(agent: string): void {
    navigate({ workspace, agent });
  }

  return (
    <ListPage
      kind="agents"
      location={location}
      showQuery={!isCreating}
      title={isCreating ? 'New agent' : 'Agents'}
      actions={
        !isCreating && (
          <ToolbarAction icon={<Plus size={16} aria-hidden />} onClick={() => setCreating(true)}>
            New agent
          </ToolbarAction>
        )
      }
    >
      <Workbench>
        <WorkbenchScroll label="Agents" isFlush={!isCreating}>
          {isCreating ? (
            <StartAgentForm
              isPending={command.pending !== undefined}
              error={command.error}
              onCancel={() => setCreating(false)}
              onStart={(input) =>
                command.run(
                  'create',
                  () => data.managed.createAgent(input),
                  (agent) => open(agent.id),
                )
              }
            />
          ) : (
            <ResourceView state={agents} label="Loading agents" placeholder={<ManagedListPlaceholder kind="agents" />}>
              {(page, notice) => (
                <>
                  {notice}
                  <ManagedAgentList
                    query={{ mode: 'frame' }}
                    agents={page.items}
                    href={(id) => router.buildLocation(managedDestination({ workspace, agent: id })).publicHref}
                    onOpen={open}
                  />
                  <SessionPagination onPrevious={paging.previous} onNext={paging.next(page.next)} />
                </>
              )}
            </ResourceView>
          )}
        </WorkbenchScroll>
      </Workbench>
    </ListPage>
  );
}

function AgentScreen({ data, agentId, location, navigate }: ManagedProps & { readonly agentId: string }): ReactNode {
  const request = useMemo(() => data.reads.agent(agentId), [data, agentId]);
  const read = useManagedAgent(data, request);
  const { visit, forget, pinned, togglePin } = useNavigationPreferences();
  const workspace = data.workspace.id;
  const agent = read.kind === 'ready' ? read.value : undefined;
  const [isFormOpen, setCreating] = useState(false);
  const isCreating = isFormOpen && agent?.archivedAt === null;
  const archivedAt = agent?.archivedAt;

  useEffect(() => {
    if (archivedAt === null) {
      visit(agentId);
    } else if (typeof archivedAt === 'string') {
      forget(agentId);
    }
  }, [archivedAt, agentId, visit, forget]);

  useEffect(() => {
    if (data.readRevocation(request) !== undefined) {
      forget(agentId);
    }
  }, [data, request, forget, agentId, read.kind]);

  return (
    <ListPage
      kind="sessions"
      location={location}
      showQuery={!isCreating}
      title={isCreating ? 'New session' : (agent?.name ?? 'Agent')}
      leading={
        <ToolbarAction
          aria-label="Back to agents"
          icon={<ArrowLeft size={16} aria-hidden />}
          onClick={() => navigate({ workspace })}
        >
          Agents
        </ToolbarAction>
      }
      actions={
        typeof agent?.archivedAt === 'string' ? (
          <Status>Archived</Status>
        ) : (
          !isCreating &&
          agent?.archivedAt === null && (
            <>
              <MechPinButton
                name={agent.name}
                isPinned={pinned.includes(agent.id)}
                onToggle={() => togglePin(agent.id)}
              />
              <ArchiveManagedResource
                kind="agent"
                name={agent.name}
                archive={() => data.managed.archiveAgent(agent.id)}
              />
              <ToolbarAction icon={<Plus size={16} aria-hidden />} onClick={() => setCreating(true)}>
                New session
              </ToolbarAction>
            </>
          )
        )
      }
    >
      <ResourceView state={read} label="Loading agent" placeholder={<ManagedListPlaceholder kind="sessions" />}>
        {(value, notice) => (
          <>
            {notice}
            <AgentSessions
              data={data}
              agent={value}
              isCreating={isCreating}
              onCancel={() => setCreating(false)}
              location={location}
              navigate={navigate}
            />
          </>
        )}
      </ResourceView>
    </ListPage>
  );
}

function AgentSessions({
  data,
  agent,
  isCreating,
  onCancel,
  location,
  navigate,
}: ManagedProps & {
  readonly isCreating: boolean;
  readonly onCancel: () => void;
  readonly agent: ManagedAgent;
}): ReactNode {
  const router = useRouter();
  const workspace = data.workspace.id;

  const request = useMemo(
    () => data.reads.sessions(agent.id, location.page ?? null, location),
    [data, agent.id, location],
  );

  const sessions = useManagedSessions(data, request);
  const attention = useAgentAttention(data, agent.id);
  const paging = useManagedPaging(location, workspace);

  function open(session: string): void {
    navigate({ workspace, agent: agent.id, session });
  }

  return (
    <Workbench>
      <WorkbenchScroll isFlush={!isCreating} label={isCreating ? 'New session' : 'Sessions'}>
        {isCreating ? (
          <SessionCreation data={data} agentId={agent.id} onCancel={onCancel} onCreated={open} />
        ) : (
          <ResourceView
            state={sessions}
            label="Loading sessions"
            placeholder={<ManagedListPlaceholder kind="sessions" />}
          >
            {(page, notice) => (
              <>
                {notice}
                <ManagedSessionList
                  query={{ mode: 'frame' }}
                  sessions={page.items}
                  activeSessionId={attention?.sessionId}
                  queuedSessionIds={attention?.queuedSessionIds}
                  href={(id) =>
                    router.buildLocation(managedDestination({ workspace, agent: agent.id, session: id })).publicHref
                  }
                  onOpen={open}
                />
                <SessionPagination onPrevious={paging.previous} onNext={paging.next(page.next)} />
              </>
            )}
          </ResourceView>
        )}
      </WorkbenchScroll>
    </Workbench>
  );
}

function SessionCreation({
  data,
  agentId,
  onCancel,
  onCreated,
}: {
  readonly data: ConsoleData;
  readonly agentId: string;
  readonly onCancel: () => void;
  readonly onCreated: (id: string) => void;
}): ReactNode {
  const [isCreatingEnvironment, setCreatingEnvironment] = useState(false);
  const [pages, setPages] = useState<ReadonlyArray<string>>([]);
  const cursor = pages.at(-1) ?? null;
  const request = useMemo(() => data.reads.managedEnvironments(cursor), [data, cursor]);
  const environments = useManagedEnvironments(data, request);
  const command = useManagedCommand();

  if (isCreatingEnvironment) {
    return (
      <CreateEnvironmentForm
        isPending={command.pending !== undefined}
        error={command.error}
        onCancel={() => setCreatingEnvironment(false)}
        onCreate={(input) =>
          command.run(
            'environment',
            () => data.managed.createEnvironment(input),
            () => {
              setPages([]);
              setCreatingEnvironment(false);
            },
          )
        }
      />
    );
  }

  return (
    <ResourceView state={environments} label="Loading environments" placeholder={<Skeleton width={176} />}>
      {(page, notice) => (
        <>
          {notice}
          <StartSessionForm
            environments={page.items}
            error={command.error}
            isPending={command.pending !== undefined}
            onCancel={onCancel}
            onCreateEnvironment={() => setCreatingEnvironment(true)}
            onStart={({ environmentId, title, firstMessage }) =>
              command.run(
                'session',
                () =>
                  data.managed.createSession({
                    agentId,
                    environmentId,
                    ...(title.length > 0 ? { title } : {}),
                    ...(firstMessage.trim().length > 0 ? { firstMessage } : {}),
                  }),
                (session) => onCreated(session.id),
              )
            }
          />
          <SessionPagination
            onPrevious={pages.length > 0 ? () => setPages(pages.slice(0, -1)) : undefined}
            onNext={
              page.next === null
                ? undefined
                : () => {
                    if (page.next !== null) {
                      setPages([...pages, page.next]);
                    }
                  }
            }
          />
        </>
      )}
    </ResourceView>
  );
}
