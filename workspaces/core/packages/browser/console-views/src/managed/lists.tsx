import { AgentAvatar, Button } from '@mechane-ai/elements';
import { DataTable, DataTablePlaceholder, DataTableText, ListFooter } from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout, TableQuery } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import type { ReactNode } from 'react';
import { SessionStatus } from './session-status.tsx';
import { ManagedTimestamp } from './timestamp.tsx';

type Agent = { readonly id: string; readonly name: string; readonly model: string; readonly version: number };

type Session = {
  readonly id: string;
  readonly title: string | null;
  readonly status: string;
  readonly updatedAt: string;
};

type RowNavigation = { readonly href: (id: string) => string; readonly onOpen: (id: string) => void };

const agentColumns = [
  { id: 'agent', label: 'Agent', role: 'primary' },
  { id: 'model', label: 'Model', role: 'text', isSecondary: true },
  { id: 'version', label: 'Version', role: 'number', width: 80 },
] as const satisfies ReadonlyArray<DataTableColumnLayout>;

const sessionColumns = [
  { id: 'session', label: 'Session', role: 'primary' },
  { id: 'status', label: 'Status', role: 'status', width: 132 },
  { id: 'updated', label: 'Updated', role: 'timestamp', width: 172, isSecondary: true },
] as const satisfies ReadonlyArray<DataTableColumnLayout>;

export function ManagedListPlaceholder({ kind }: { readonly kind: 'agents' | 'sessions' }): ReactNode {
  return (
    <DataTablePlaceholder
      caption={kind === 'agents' ? 'Agents' : 'Sessions'}
      columns={kind === 'agents' ? agentColumns : sessionColumns}
    />
  );
}

export function ManagedAgentList({
  query,
  agents,
  href,
  onOpen,
}: RowNavigation & { readonly query: TableQuery<Agent>; readonly agents: ReadonlyArray<Agent> }): ReactNode {
  return (
    <DataTable
      query={query}
      caption="Agents"
      hideCaption
      rows={agents}
      getRowId={(agent) => agent.id}
      rowAction={{
        href: (agent) => href(agent.id),
        onActivate: (agent) => onOpen(agent.id),
        label: (agent) => `Open ${agent.name}`,
      }}
      columns={[
        {
          ...agentColumns[0],
          cell: (agent) => (
            <DataTableText leading={<AgentAvatar seed={agent.id} size="md" />}>{agent.name}</DataTableText>
          ),
        },
        { ...agentColumns[1], cell: (agent) => <DataTableText>{agent.model}</DataTableText> },
        { ...agentColumns[2], cell: (agent) => agent.version },
      ]}
      empty={<EmptyState title="No agents in this workspace" />}
    />
  );
}

export function ManagedSessionList({
  query,
  sessions,
  activeSessionId,
  queuedSessionIds,
  href,
  onOpen,
}: RowNavigation & {
  readonly query: TableQuery<Session>;
  readonly sessions: ReadonlyArray<Session>;
  readonly activeSessionId?: string | null | undefined;
  readonly queuedSessionIds?: ReadonlyArray<string> | undefined;
}): ReactNode {
  return (
    <DataTable
      query={query}
      caption="Sessions"
      hideCaption
      rows={sessions}
      getRowId={(session) => session.id}
      rowAction={{
        href: (session) => href(session.id),
        onActivate: (session) => onOpen(session.id),
        label: (session) => `Open ${session.title ?? session.id}`,
      }}
      columns={[
        { ...sessionColumns[0], cell: (session) => <DataTableText>{session.title ?? session.id}</DataTableText> },
        {
          ...sessionColumns[1],
          cell: (session) => (
            <SessionStatus
              status={session.status}
              isExecuting={session.id === activeSessionId}
              isWaiting={queuedSessionIds?.includes(session.id)}
            />
          ),
        },
        { ...sessionColumns[2], cell: (session) => <ManagedTimestamp value={session.updatedAt} /> },
      ]}
      empty={<EmptyState title="No sessions yet">Start a session to work with this agent.</EmptyState>}
    />
  );
}

export function SessionPagination({
  onPrevious,
  onNext,
}: {
  readonly onPrevious?: (() => void) | undefined;
  readonly onNext?: (() => void) | undefined;
}): ReactNode {
  if (onPrevious === undefined && onNext === undefined) {
    return null;
  }

  return (
    <ListFooter
      actions={
        <>
          <Button onClick={onPrevious} disabled={onPrevious === undefined}>
            Previous
          </Button>
          <Button onClick={onNext} disabled={onNext === undefined}>
            Next
          </Button>
        </>
      }
    />
  );
}
