import { AgentAvatar, Button, TextButton } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import {
  DetailPage,
  Navigation,
  NavigationLink,
  NavigationSection,
  PageToolbar,
  ToolbarAction,
  Workbench,
  WorkbenchFooter,
  WorkbenchScroll,
} from '@mechane-ai/elements/layout';
import type { TraceTab } from '@mechane/console-views';
import {
  Activity,
  ArchivedConversation,
  ConsoleShell,
  ConversationPlaceholder,
  ManagedAgentList,
  ManagedListPlaceholder,
  ManagedSessionList,
  MechPagePlaceholder,
  SessionComposer,
  SessionStatus,
  SessionTranscript,
  TurnList,
  TurnTrace,
} from '@mechane/console-views';
import {
  ConsoleMessagePage,
  EventPage,
  REPLY_EXCERPT_MAX_CHARS,
  Trace,
  TurnPage,
  TurnRuntimeSource,
  WorkspaceList,
} from '@mechane/protocol';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Schema } from 'effect';
import { ArrowLeft, Bot, Settings } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ResourceView } from '../resource.tsx';

const meta = {
  title: 'Screens/Console',
  tags: ['!supported'],
  component: ConsoleShell,
  subcomponents: { ManagedAgentList, ManagedSessionList, SessionTranscript, SessionComposer, Activity, TurnTrace },
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

const nativeMechId = 'dc656ff2-2844-4ada-b87c-1dc9ac64914e';
const turnId = '52d0e964-811d-44f4-a96e-d38ca5df748b';
const notificationId = '08c361a4-a15b-487b-b917-1c588b48be12';

const recordedReply = [
  'The release candidate is ready for review. All three packages passed their checks. The deployment can proceed once the release tag is published.',
  '',
  '## Checks',
  '',
  '| Package | Result |',
  '| --- | --- |',
  '| Console | Passed |',
  '| Protocol | Passed |',
  '| Worker | Passed |',
  '',
  '## Review notes',
  '',
  'The packaged Console retains message drafts when sending fails. Request links reopen the selected turn, and the full recorded reply remains available beyond the short overview excerpt. Missing provider usage remains unavailable rather than appearing as zero tokens.',
  '',
  '## Repeat the check',
  '',
  '```sh',
  'mise run check:fast',
  '```',
  '',
  'Publish the release only after the remaining review is complete.',
].join('\n');

const turnInputEvents = [
  {
    type: 'notification.received',
    sequence: 101,
    occurred_at: '2026-11-02T11:59:59Z',
    notification_id: notificationId,
    received_sequence: 1,
    text: 'Review the release candidate and summarize the checks with a command to repeat them.',
    source: { name: 'console', eventId: notificationId },
  },
  {
    type: 'activation.started',
    sequence: 102,
    occurred_at: '2026-11-02T12:00:00Z',
    turn_id: turnId,
    notification_ids: [notificationId],
  },
];

const recordedReplyEvent = {
  type: 'activation.completed',
  sequence: 107,
  occurred_at: '2026-11-02T12:00:04Z',
  turn_id: turnId,
  notification_ids: [notificationId],
};

const completedEvents = Schema.decodeUnknownSync(EventPage)({
  has_more: false,
  events: [...turnInputEvents, recordedReplyEvent],
});

const runningEvents = Schema.decodeUnknownSync(EventPage)({ has_more: false, events: turnInputEvents });

const refusedEvents = Schema.decodeUnknownSync(EventPage)({
  has_more: false,
  events: [
    ...turnInputEvents,
    {
      type: 'activation.failed',
      sequence: 103,
      occurred_at: '2026-11-02T12:00:00Z',
      turn_id: turnId,
      reason: 'allowance_exhausted',
      notification_ids: [notificationId],
    },
  ],
});

const completedTrace = Schema.decodeUnknownSync(Trace)({
  reply_excerpt: {
    sequence: 107,
    text: recordedReply.slice(0, REPLY_EXCERPT_MAX_CHARS),
    truncated: recordedReply.length > REPLY_EXCERPT_MAX_CHARS,
  },
  turn: {
    id: turnId,
    version: 3,
    status: 'completed',
    notification_ids: [notificationId],
    created_at: '2026-11-02T11:59:59Z',
    started_at: '2026-11-02T12:00:00Z',
    ended_at: '2026-11-02T12:00:04Z',
    definition_revision: 1,
  },
  dispatches: [
    {
      id: 'a9f822cc-291d-42bf-ab6c-c7ab2f717580',
      model: 'openai/gpt-5-mini',
      requested_micros: 10_000,
      decided_at: '2026-11-02T12:00:00Z',
      status: 'settled',
      settled_micros: 2300,
      settled_at: '2026-11-02T12:00:02Z',
      basis: 'usage',
      input_tokens: 500,
      output_tokens: 100,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    },
    {
      id: '7d91403e-b978-43a9-ae49-d5e68347d6cc',
      model: 'openai/gpt-5-mini',
      requested_micros: 10_000,
      decided_at: '2026-11-02T12:00:02Z',
      status: 'settled',
      settled_micros: 1600,
      settled_at: '2026-11-02T12:00:04Z',
      basis: 'usage',
      input_tokens: 600,
      output_tokens: 50,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    },
  ],
});

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
            {agents.slice(1).map((mech) => (
              <NavigationLink key={mech.id} href={`#${mech.id}`} icon={<AgentAvatar seed={mech.id} />}>
                {mech.name}
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
      <PageToolbar title="Agents" />
      <Workbench>
        <WorkbenchScroll isFlush label="Agents">
          <ManagedAgentList agents={isEmpty ? [] : agents} href={(id) => `#${id}`} onOpen={() => undefined} />
        </WorkbenchScroll>
      </Workbench>
    </StoryShell>
  );
}

function TraceStory({
  trace,
  notice,
  events = completedEvents,
  initialTab = 'Overview',
  onBack,
}: {
  readonly trace: Trace;
  readonly notice?: ReactNode;
  readonly events?: EventPage;
  readonly initialTab?: TraceTab;
  readonly onBack?: () => void;
}): ReactNode {
  const [tab, setTab] = useState<TraceTab>(initialTab);
  const [request, setRequest] = useState<string>();

  return (
    <StoryShell shouldFocus>
      <PageToolbar
        showNavigation={false}
        title={scout.name}
        leading={
          <ToolbarAction icon={<ArrowLeft size={16} aria-hidden />} onClick={onBack}>
            Back
          </ToolbarAction>
        }
      />
      {notice}
      <Workbench>
        <WorkbenchScroll label="Run details" scrollRestorationId="run">
          <TurnTrace
            trace={trace}
            tab={tab}
            onTab={setTab}
            requestId={request}
            onRequest={(id) => {
              setRequest(id);
              setTab('Requests');
            }}
            requestHref={(id) =>
              `https://mechane.example/console?workspace=${workspaceList.workspaces[0].id}&mech=${nativeMechId}&turn=${trace.turn.id}&view=requests&request=${id}`
            }
            replyLink={() => <TextButton onClick={() => setTab('Events')}>Read full message →</TextButton>}
            events={<Activity label="Run events" hasInset={false} page={events} />}
          />
        </WorkbenchScroll>
      </Workbench>
    </StoryShell>
  );
}

export const Agents: Story = { render: () => <DirectoryStory /> };

export const CompletedTurn: Story = { render: () => <TraceStory trace={completedTrace} /> };

export const RequestTimeline: Story = { render: () => <TraceStory trace={completedTrace} initialTab="Requests" /> };

export const ToolInspection: Story = { render: () => <TraceStory trace={inspectedTrace} initialTab="Tools" /> };

export const NarrowToolInspection: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <TraceStory trace={inspectedTrace} initialTab="Tools" />,
};

export const RecordedConversation: Story = { render: () => <TraceStory trace={completedTrace} initialTab="Events" /> };

export const UnavailableReply: Story = {
  render: () => (
    <TraceStory
      trace={Schema.decodeUnknownSync(Trace)({ turn: encodedTrace.turn, dispatches: encodedTrace.dispatches })}
    />
  ),
};

export const Empty: Story = { render: () => <DirectoryStory isEmpty /> };

export const FailedRefresh: Story = {
  render: () => (
    <TraceStory
      trace={completedTrace}
      notice={
        <Notice hasError>
          Refresh failed. Showing the last saved result. <Button>Retry refresh</Button>
        </Notice>
      }
    />
  ),
};

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

export const RunListLoading: Story = {
  render: () => (
    <StoryShell>
      <ResourceView state={{ kind: 'pending' }} label="Loading runs" placeholder={<MechPagePlaceholder view="runs" />}>
        {() => null}
      </ResourceView>
    </StoryShell>
  ),
};

export const RunLoading: Story = {
  render: () => (
    <StoryShell shouldFocus>
      <ResourceView
        state={{ kind: 'pending' }}
        label="Loading run"
        placeholder={<MechPagePlaceholder view="runs" hasFocusedRun />}
      >
        {() => null}
      </ResourceView>
    </StoryShell>
  ),
};

const encodedTrace = Schema.encodeSync(Trace)(completedTrace);

const inspectedTrace = Schema.decodeUnknownSync(Trace)({
  ...encodedTrace,
  tool_calls: [
    {
      id: 'catalog-query',
      name: 'bash',
      status: 'completed',
      started_at: '2026-11-02T12:00:00.500Z',
      ended_at: '2026-11-02T12:00:00.620Z',
      inspection: {
        kind: 'bash',
        command: { text: "jq '.links' catalog.json", omitted_bytes: 0 },
        result: {
          status: 'completed',
          exit_code: 127,
          duration_ms: 120,
          output: { text: 'bash: jq: command not found\n', omitted_bytes: 0 },
        },
      },
    },
    {
      id: 'catalog-read',
      name: 'bash',
      status: 'completed',
      started_at: '2026-11-02T12:00:02.100Z',
      ended_at: '2026-11-02T12:00:02.800Z',
      inspection: {
        kind: 'bash',
        command: {
          text: "curl --header 'Authorization: Bearer [REDACTED]' https://example.com/catalog\nnode scripts/check-catalog.mjs",
          omitted_bytes: 0,
        },
        result: {
          status: 'completed',
          exit_code: 0,
          duration_ms: 700,
          output: { text: 'Checked 120 catalog entries.\nOne matching entry.\n', omitted_bytes: 4096 },
        },
      },
    },
    {
      id: 'catalog-exists',
      name: 'bash',
      status: 'completed',
      started_at: '2026-11-02T12:00:02.900Z',
      ended_at: '2026-11-02T12:00:02.950Z',
      inspection: {
        kind: 'bash',
        command: { text: 'test -f catalog.json', omitted_bytes: 0 },
        result: { status: 'completed', exit_code: 0, duration_ms: 50, output: { text: '', omitted_bytes: 0 } },
      },
    },
    {
      id: 'earlier-catalog-read',
      name: 'bash',
      status: 'completed',
      started_at: '2026-11-02T12:00:03.000Z',
      ended_at: '2026-11-02T12:00:03.100Z',
      inspection: {
        kind: 'bash',
        command: null,
        result: {
          status: 'completed',
          exit_code: 0,
          duration_ms: 100,
          output: { text: 'One matching entry.\n', omitted_bytes: 0 },
        },
      },
    },
    {
      id: 'catalog-note',
      name: 'record_note',
      status: 'completed',
      started_at: '2026-11-02T12:00:03.200Z',
      ended_at: '2026-11-02T12:00:03.300Z',
    },
  ],
});

const sampleRequest = encodedTrace.dispatches[0];

export const RefusedTurn: Story = {
  render: () => (
    <TraceStory
      events={refusedEvents}
      trace={Schema.decodeUnknownSync(Trace)({
        turn: { ...encodedTrace.turn, status: 'failed', reason: 'allowance_exhausted' },
        dispatches: [{ ...sampleRequest, status: 'refused' }],
      })}
    />
  ),
};

export const RunningTurn: Story = {
  render: () => (
    <TraceStory
      events={runningEvents}
      trace={Schema.decodeUnknownSync(Trace)({
        turn: { ...encodedTrace.turn, version: 2, status: 'running' },
        dispatches: [{ ...sampleRequest, status: 'reserved' }],
      })}
    />
  ),
};

const importedTrace = Schema.decodeUnknownSync(Trace)({
  ...encodedTrace,
  turn: { ...encodedTrace.turn, runtime_source: TurnRuntimeSource.Imported, status: 'running' },
  dispatches: [],
  evidence_notices: ['Imported historical execution; no historical tool was replayed.'],
  tool_calls: [
    {
      id: 'imported-command',
      name: 'bash',
      status: 'running',
      started_at: '2026-11-02T12:00:00.500Z',
      ended_at: null,
      inspection: {
        kind: 'bash',
        command: { text: 'node scripts/check-catalog.mjs', omitted_bytes: 0 },
        result: {
          status: 'running',
          exit_code: null,
          duration_ms: null,
          output: { text: 'Last recorded output.\n', omitted_bytes: 0 },
        },
      },
    },
  ],
});

export const ImportedTurn: Story = { render: () => <TraceStory trace={importedTrace} /> };

export const ImportedRuns: Story = {
  render: () => (
    <StoryShell>
      <DetailPage>
        <TurnList
          page={{ turns: [importedTrace.turn], hasMore: false }}
          turnHref={(id) => `?turn=${id}`}
          onOpen={() => undefined}
          emptyDescription="Imported execution history appears here."
        />
      </DetailPage>
    </StoryShell>
  ),
};

export const QueuedTurn: Story = {
  render: () => (
    <TraceStory
      trace={Schema.decodeUnknownSync(Trace)({
        turn: { ...encodedTrace.turn, version: 1, status: 'queued', started_at: null },
        dispatches: [],
        tool_calls: [],
      })}
    />
  ),
};

export const QuietCompletion: Story = {
  render: () => (
    <TraceStory
      trace={Schema.decodeUnknownSync(Trace)({
        turn: { ...encodedTrace.turn, version: 3, status: 'completed' },
        dispatches: encodedTrace.dispatches,
        tool_calls: [],
      })}
    />
  ),
};

export const MissingUsage: Story = {
  render: () => (
    <TraceStory
      initialTab="Requests"
      trace={Schema.decodeUnknownSync(Trace)({
        ...encodedTrace,
        dispatches: [{ ...sampleRequest, basis: 'reservation' }],
      })}
    />
  ),
};

export const NewerRequestFormat: Story = {
  render: () => (
    <TraceStory
      initialTab="Requests"
      trace={Schema.decodeUnknownSync(Trace)({
        ...encodedTrace,
        dispatches: [
          { ...sampleRequest, id: 'df5f71fa-cada-4b63-a3f4-4a0db43da51a', status: 'recorded_by_newer_release' },
          ...encodedTrace.dispatches,
        ],
      })}
    />
  ),
};

export const NewerEventFormat: Story = {
  render: () => (
    <TraceStory
      trace={completedTrace}
      initialTab="Events"
      events={Schema.decodeUnknownSync(EventPage)({
        has_more: false,
        events: [
          ...turnInputEvents,
          { type: 'newer.event', sequence: 106, occurred_at: '2026-11-02T12:00:03Z' },
          recordedReplyEvent,
        ],
      })}
    />
  ),
};

const longRunPage = Schema.decodeUnknownSync(TurnPage)({
  has_more: false,
  turns: Array.from({ length: 18 }, (_, index) => ({
    ...encodedTrace.turn,
    id: `52d0e964-811d-44f4-a96e-${String(index).padStart(12, '0')}`,
    input_excerpt:
      index === 0
        ? 'Verify the release'
        : 'Review the database restore, confirm every source hash, and summarize the full deployment verification without changing the running installation',
  })),
});

export const LongTitlesAndRuns: Story = {
  render: () => (
    <StoryShell>
      <PageToolbar title={scout.name} />
      <Workbench>
        <WorkbenchScroll isFlush label="Runs">
          <TurnList
            page={longRunPage}
            turnHref={(id) => `?mech=${nativeMechId}&turn=${id}`}
            onOpen={() => undefined}
            emptyDescription="No runs were recorded for this mech."
          />
        </WorkbenchScroll>
      </Workbench>
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
      <PageToolbar title={releaseReview.title} actions={<SessionStatus status={releaseReview.status} />} />
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
    </StoryShell>
  );
}

export const Sessions: Story = {
  render: () => (
    <StoryShell>
      <PageToolbar title={scout.name} />
      <Workbench>
        <WorkbenchScroll isFlush label="Sessions">
          <ManagedSessionList
            sessions={[dependencyUpdate, releaseReview]}
            activeSessionId={dependencyUpdate.id}
            href={(id) => `#${id}`}
            onOpen={() => undefined}
          />
        </WorkbenchScroll>
      </Workbench>
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

export const HistoryWorkspace: Story = {
  render: () => (
    <StoryShell>
      <PageToolbar title={scout.name} />
      <Workbench>
        <WorkbenchScroll isFlush label="Events">
          <Activity page={{ ...completedEvents, events: completedEvents.events.toReversed() }} />
        </WorkbenchScroll>
      </Workbench>
    </StoryShell>
  ),
};

const archivedMessages = Schema.decodeUnknownSync(ConsoleMessagePage)({
  messages: [
    {
      id: 'eb5adcc0-9988-46da-8c84-9e615048c0dd',
      mech_id: nativeMechId,
      run_id: turnId,
      role: 'assistant',
      text: 'The Console package passed.',
      created_at: '2026-11-02T12:00:04Z',
      sequence: 1,
      presentation: {
        spec: {
          root: 'summary',
          elements: {
            summary: { type: 'Card', props: { title: 'Archived release checks' }, children: ['console'] },
            console: { type: 'Text', props: { content: 'The Console package passed.' }, children: [] },
          },
        },
        fallback: 'The Console package passed.',
      },
    },
  ],
  before_sequence: 1,
  has_more: false,
});

export const ArchivedMessages: Story = {
  render: () => (
    <StoryShell>
      <PageToolbar title={scout.name} />
      <Workbench>
        <ArchivedConversation
          name={scout.name}
          messages={archivedMessages.messages}
          controls={null}
          scrollRestorationId="story-archive"
          inspect={(run) => <a href={`?mech=${nativeMechId}&turn=${run}&view=conversation`}>Open run</a>}
        />
      </Workbench>
    </StoryShell>
  ),
};
