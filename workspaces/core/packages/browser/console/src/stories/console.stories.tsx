import { AgentAvatar } from '@mechane-ai/elements';
import {
  Navigation,
  NavigationLink,
  NavigationSection,
  PageLayout,
  Workbench,
  WorkbenchFooter,
  WorkbenchScroll,
} from '@mechane-ai/elements/layout';
import {
  ConsoleShell,
  ConversationPlaceholder,
  ManagedAgentList,
  ManagedListPlaceholder,
  ManagedSessionList,
  SessionComposer,
  SessionStatus,
  SessionTranscript,
} from '@mechane/console-views';
import { WorkspaceList } from '@mechane/protocol';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Schema } from 'effect';
import { Bot, Settings } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ResourceView } from '../resource.tsx';

const meta = {
  title: 'Screens/Console',
  tags: ['!supported'],
  component: ConsoleShell,
  subcomponents: { ManagedAgentList, ManagedSessionList, SessionTranscript, SessionComposer },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported Console compositions use the real shell and resource views with fixed synthetic records. The application supplies authorized data, route state, commands, and formatting. Use package stories for individual controls. These examples document visual states; they do not prove authentication or real API behavior.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const workspaceList = Schema.decodeUnknownSync(WorkspaceList)({
  workspaces: [
    {
      id: '48cde045-0aaf-4c52-ae8e-faf1caa708e4',
      name: 'Personal workspace',
      kind: 'personal',
      role: 'owner',
      daily_allowance_micros: 10_000_000,
      created_at: '2026-10-15T12:00:00Z',
    },
    {
      id: 'dca2ed60-d0a3-45f0-bbd1-6c7baef01512',
      name: 'Engineering',
      kind: 'shared',
      role: 'member',
      daily_allowance_micros: 50_000_000,
      created_at: '2026-10-20T12:00:00Z',
    },
  ],
});

const scout = { id: 'agent_repository_scout', name: 'Repository scout', model: 'claude-sonnet-4-6', version: 1 };

const agents = [
  scout,
  { id: 'agent_daily_brief', name: 'Daily briefing', model: 'claude-sonnet-4-6', version: 3 },
  { id: 'agent_release', name: 'Release watcher', model: 'claude-sonnet-4-6', version: 2 },
];

function StoryShell({
  children,
  shouldFocus = false,
}: {
  readonly children: ReactNode;
  readonly shouldFocus?: boolean;
}): ReactNode {
  const [workspaceId, setWorkspaceId] = useState<string>(
    workspaceList.workspaces[1]?.id ?? workspaceList.workspaces[0].id,
  );

  return (
    <ConsoleShell
      workspaceId={workspaceId}
      workspaces={workspaceList.workspaces}
      onWorkspace={setWorkspaceId}
      shouldFocus={shouldFocus}
      homeLink={
        <Navigation>
          <NavigationSection label="Overview">
            <NavigationLink href="#agents" icon={<Bot size={16} />} isSelected>
              Agents
            </NavigationLink>
          </NavigationSection>
          <NavigationSection label="Pinned">
            <NavigationLink href="#scout" icon={<AgentAvatar seed={scout.id} />}>
              {scout.name}
            </NavigationLink>
          </NavigationSection>
          <NavigationSection label="Recent">
            {agents.slice(1).map((agent) => (
              <NavigationLink key={agent.id} href={`#${agent.id}`} icon={<AgentAvatar seed={agent.id} />}>
                {agent.name}
              </NavigationLink>
            ))}
          </NavigationSection>
        </Navigation>
      }
      accountLink={
        <NavigationLink href="#settings" icon={<Settings size={16} />} aria-label="Settings for Jordan Lee">
          Jordan Lee
        </NavigationLink>
      }
    >
      {children}
    </ConsoleShell>
  );
}

function DirectoryStory({ isEmpty = false }: { readonly isEmpty?: boolean }): ReactNode {
  return (
    <StoryShell>
      <PageLayout title="Agents">
        <Workbench>
          <WorkbenchScroll isFlush label="Agents">
            <ManagedAgentList
              query={{
                mode: 'local',
                search: (agent) => [agent.name, agent.id, agent.model].join(' '),
                filters: [{ id: 'model', label: 'Model', value: (agent) => agent.model }],
              }}
              agents={isEmpty ? [] : agents}
              href={(id) => `#${id}`}
              onOpen={() => undefined}
            />
          </WorkbenchScroll>
        </Workbench>
      </PageLayout>
    </StoryShell>
  );
}

export const Agents: Story = { render: () => <DirectoryStory /> };

export const Empty: Story = { render: () => <DirectoryStory isEmpty /> };

export const Loading: Story = {
  render: () => (
    <StoryShell>
      <ResourceView
        state={{ kind: 'pending' }}
        label="Loading agents"
        placeholder={<ManagedListPlaceholder kind="agents" />}
      >
        {() => null}
      </ResourceView>
    </StoryShell>
  ),
};

const releaseReview = {
  id: 'ses_release_review',
  title: 'Review the release candidate',
  status: 'idle',
  updatedAt: '2026-11-02T12:00:04Z',
};

const dependencyUpdate = {
  id: 'ses_dependency_update',
  title: 'Update the test runner',
  status: 'running',
  updatedAt: '2026-11-02T12:02:00Z',
};

const eventFields = { threadId: null, toolName: null, permission: null, stopReason: null };
type SessionEvents = ComponentProps<typeof SessionTranscript>['events'];

const reviewEvents: SessionEvents = [
  {
    ...eventFields,
    id: 'sevt_user_review',
    type: 'user.message',
    processedAt: '2026-11-02T11:59:59Z',
    text: 'Review the release candidate and summarize the checks.',
  },
  {
    ...eventFields,
    id: 'sevt_run_checks',
    type: 'agent.tool_use',
    toolName: 'bash',
    processedAt: '2026-11-02T12:00:00Z',
    text: 'Run the release checks',
  },
  {
    ...eventFields,
    id: 'sevt_checks_complete',
    type: 'agent.tool_result',
    processedAt: '2026-11-02T12:00:02Z',
    text: '',
  },
  {
    ...eventFields,
    id: 'sevt_review_reply',
    type: 'agent.message',
    processedAt: '2026-11-02T12:00:04Z',
    text: 'The Console, protocol, and Worker checks passed. Run `mise run check:fast` to repeat them.',
  },
];

function SessionStory(): ReactNode {
  const [draft, setDraft] = useState('');
  const [events, setEvents] = useState(reviewEvents);

  return (
    <StoryShell>
      <PageLayout title={releaseReview.title} actions={<SessionStatus status={releaseReview.status} />}>
        <Workbench>
          <SessionTranscript events={events} agentName={scout.name} reader={{ id: 'story-release-review' }} />
          <WorkbenchFooter>
            <SessionComposer
              value={draft}
              onChange={setDraft}
              isPending={false}
              onSend={() => {
                if (draft.trim() === '') {
                  return;
                }

                setEvents([
                  ...events,
                  {
                    ...eventFields,
                    id: `sevt_draft_${events.length}`,
                    type: 'user.message',
                    text: draft,
                    processedAt: null,
                  },
                ]);
                setDraft('');
              }}
            />
          </WorkbenchFooter>
        </Workbench>
      </PageLayout>
    </StoryShell>
  );
}

export const Sessions: Story = {
  render: () => (
    <StoryShell>
      <PageLayout title={scout.name}>
        <Workbench>
          <WorkbenchScroll isFlush label="Sessions">
            <ManagedSessionList
              query={{
                mode: 'local',
                search: (session) => [session.title, session.id].join(' '),
                filters: [{ id: 'status', label: 'Status', value: (session) => session.status }],
              }}
              sessions={[dependencyUpdate, releaseReview]}
              activeSessionId={dependencyUpdate.id}
              href={(id) => `#${id}`}
              onOpen={() => undefined}
            />
          </WorkbenchScroll>
        </Workbench>
      </PageLayout>
    </StoryShell>
  ),
};

export const SessionConversation: Story = { render: () => <SessionStory /> };

export const SessionLoading: Story = {
  render: () => (
    <StoryShell>
      <ResourceView state={{ kind: 'pending' }} label="Loading session" placeholder={<ConversationPlaceholder />}>
        {() => null}
      </ResourceView>
    </StoryShell>
  ),
};
