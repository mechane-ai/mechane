import { AgentAvatar, Button, Heading, IconButton, Muted, Row, Stack, TextButton } from '@mechane-ai/elements';
import type { AgentAppearance } from '@mechane-ai/elements';
import { MessageAction, PromptInput } from '@mechane-ai/elements/ai';
import { CollectionToolbar } from '@mechane-ai/elements/collections';
import { Notice } from '@mechane-ai/elements/feedback';
import { Field, Input } from '@mechane-ai/elements/forms';
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
import { PageNavigation } from '@mechane-ai/elements/navigation';
import type { TraceTab } from '@mechane/console-views';
import {
  Activity,
  ConsoleShell,
  EnvironmentProcesses,
  MechConversation,
  MechHeader,
  MechList,
  MechPagePlaceholder,
  MechSettings,
  MechsPagePlaceholder,
  DefinitionConflict as SavedDefinition,
  TurnList,
  TurnTrace,
} from '@mechane/console-views';
import {
  Allowance,
  ConsoleMessagePage,
  EventPage,
  Mech,
  MechPage,
  MechSummary,
  REPLY_EXCERPT_MAX_CHARS,
  Trace,
  TurnPage,
  WorkspaceList,
} from '@mechane/protocol';
import type { ConsoleView } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Option, Schema } from 'effect';
import { ArrowLeft, Bot, ListTree, Plus, RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ResourceView } from '../resource.tsx';

const activeRunStatuses: ReadonlySet<string> = new Set(['queued', 'running']);

const meta = {
  title: 'Screens/Console',
  tags: ['!supported'],
  component: ConsoleShell,
  subcomponents: { Activity, MechConversation, MechHeader, MechList, DefinitionConflict: SavedDefinition, TurnTrace },
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

const allowance = Schema.decodeUnknownSync(Allowance)({
  day: '2026-11-02',
  daily_allowance_micros: 10_000_000,
  committed_micros: 650_000,
});

const mechPage = Schema.decodeUnknownSync(MechPage)({
  mechs: [
    {
      id: 'dc656ff2-2844-4ada-b87c-1dc9ac64914e',
      name: 'Repository scout',
      model: 'openai/gpt-5-mini',
      revision: 1,
      status: 'active',
      creator_id: 'd9a81e36-fd09-4d26-9f8e-3d27a28740ab',
      created_at: '2026-11-02T12:00:00Z',
      forked_from: null,
    },
    {
      id: '14290322-7450-4f99-9b42-5b5b56b9a993',
      name: 'Daily briefing',
      model: 'openai/gpt-5-mini',
      revision: 3,
      status: 'paused',
      creator_id: 'd9a81e36-fd09-4d26-9f8e-3d27a28740ab',
      created_at: '2026-10-30T09:00:00Z',
      forked_from: null,
    },
    {
      id: 'f1f7d720-83a6-47e4-8417-fb763b3b82d5',
      name: 'Release watcher',
      model: 'openai/gpt-5-mini',
      revision: 2,
      status: 'active',
      creator_id: 'd9a81e36-fd09-4d26-9f8e-3d27a28740ab',
      created_at: '2026-10-28T16:30:00Z',
      forked_from: null,
    },
  ],
  has_more: false,
});

const sampleMech = mechPage.mechs.find((mech) => mech.name === 'Repository scout');

if (sampleMech === undefined) {
  throw new Error('Story requires Repository scout');
}

const scout = sampleMech;
const encodedScout = Schema.encodeSync(MechSummary)(scout);

const scoutDefinition = Schema.decodeUnknownSync(Mech)({
  ...encodedScout,
  instructions:
    'Inspect the repository before each release. Report the checks that ran and preserve the running installation.',
  daily_cap_micros: 5_000_000,
  active_revision: scout.revision,
  updated_at: encodedScout.created_at,
  updater_id: encodedScout.creator_id,
});

const emptyPage = Schema.decodeUnknownSync(MechPage)({ mechs: [], has_more: false });
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
            <NavigationLink href="#mechs" icon={<Bot size={16} />} isSelected>
              Mechs
            </NavigationLink>
          </NavigationSection>
          <NavigationSection label="Pinned">
            <NavigationLink href="#scout" icon={<AgentAvatar seed={scout.id} />}>
              {scout.name}
            </NavigationLink>
          </NavigationSection>
          <NavigationSection label="Recent">
            {mechPage.mechs.slice(1).map((mech) => (
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

function MechsToolbar(): ReactNode {
  return (
    <PageToolbar
      title="Mechs"
      actions={
        <>
          <IconButton variant="ghost" aria-label="Refresh mechs" onClick={() => undefined}>
            <RefreshCw size={16} aria-hidden />
          </IconButton>
          <ToolbarAction icon={<Plus size={16} aria-hidden />} onClick={() => undefined}>
            Create mech
          </ToolbarAction>
        </>
      }
    />
  );
}

function MechsStory({ page }: { readonly page: MechPage }): ReactNode {
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set([scout.id]));

  return (
    <StoryShell>
      <MechsToolbar />
      <MechList
        hasPrevious={false}
        page={page}
        allowance={allowance}
        pinnedIds={pinned}
        onTogglePin={(mech) =>
          setPinned((previous) =>
            previous.has(mech.id)
              ? new Set([...previous].filter((id) => id !== mech.id))
              : new Set([...previous, mech.id]),
          )
        }
        mechHref={(mech) => `?mech=${mech.id}`}
        onOpen={() => undefined}
        onCreate={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
      />
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
        actions={
          activeRunStatuses.has(trace.turn.status) && (
            <ToolbarAction onClick={() => undefined}>Cancel run</ToolbarAction>
          )
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
              `https://mechane.example/console?workspace=${workspaceList.workspaces[0].id}&mech=${scout.id}&turn=${trace.turn.id}&view=requests&request=${id}`
            }
            replyLink={() => <TextButton onClick={() => setTab('Events')}>Read full message →</TextButton>}
            events={<Activity label="Run events" hasInset={false} page={events} />}
          />
        </WorkbenchScroll>
      </Workbench>
    </StoryShell>
  );
}

export const Mechs: Story = { render: () => <MechsStory page={mechPage} /> };

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

export const Empty: Story = { render: () => <MechsStory page={emptyPage} /> };

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

export const DefinitionConflict: Story = {
  render: () => (
    <StoryShell>
      <PageToolbar showBreadcrumb title="Repository scout / Edit definition" />
      <DetailPage>
        <Stack>
          <Heading>Edit Repository scout</Heading>
          <Muted>Editing revision 1.</Muted>
          <SavedDefinition
            saved={{
              ...scout,
              revision: 2,
              dailyCapMicros: Micros.make(5_000_000),
              instructions: Option.some('Inspect the workspace before each release.'),
            }}
            onContinue={() => undefined}
            onRefresh={() => undefined}
          />
          <Field.Root name="name">
            <Field.Label>Name</Field.Label>
            <Input value="Repository scout" readOnly />
          </Field.Root>

          <Row>
            <Button variant="solid" disabled>
              Save definition
            </Button>
            <Button>Cancel</Button>
          </Row>
        </Stack>
      </DetailPage>
    </StoryShell>
  ),
};

export const Loading: Story = {
  render: () => (
    <StoryShell>
      <ResourceView state={{ kind: 'pending' }} label="Loading mechs" placeholder={<MechsPagePlaceholder />}>
        {() => null}
      </ResourceView>
    </StoryShell>
  ),
};

export const ConversationLoading: Story = {
  render: () => (
    <StoryShell>
      <ResourceView
        state={{ kind: 'pending' }}
        label="Loading conversation"
        placeholder={<MechPagePlaceholder view="conversation" />}
      >
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
        placeholder={<MechPagePlaceholder view="conversation" hasFocusedRun />}
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

const collectionViews: ReadonlySet<ConsoleView> = new Set(['runs', 'activity']);

function WorkspaceStory({
  initialView = 'conversation',
  hasLongName = false,
}: {
  readonly initialView?: ConsoleView;
  readonly hasLongName?: boolean;
}): ReactNode {
  const [view, setView] = useState<ConsoleView>(initialView);
  const [hasFocusedRun, setFocusedRun] = useState(false);
  const [isPinned, setPinned] = useState(true);
  const [draft, setDraft] = useState('Verify the release and preserve the running installation.');
  const [appearance, setAppearance] = useState<AgentAppearance>();

  const mech = {
    ...scoutDefinition,
    name: hasLongName ? 'Repository scout for infrastructure, releases, and deployment verification' : scout.name,
  };

  if (hasFocusedRun) {
    return <TraceStory trace={completedTrace} onBack={() => setFocusedRun(false)} />;
  }

  return (
    <StoryShell>
      <MechHeader
        mech={mech}
        appearance={appearance}
        view={view}
        isPinned={isPinned}
        isBusy={false}
        viewHref={(next) => `?mech=${mech.id}&view=${next}`}
        onView={setView}
        onPin={() => setPinned(!isPinned)}
        onStatus={() => undefined}
      />
      <Workbench>
        {view === 'conversation' ? (
          <>
            <MechConversation
              messages={
                Schema.decodeUnknownSync(ConsoleMessagePage)({
                  messages: [
                    {
                      id: notificationId,
                      mech_id: mech.id,
                      run_id: null,
                      role: 'user',
                      text: 'Review the release candidate and summarize the checks with a command to repeat them.',
                      presentation: null,
                      created_at: '2026-11-02T11:59:59Z',
                      sequence: 1,
                    },
                    {
                      id: '2b8ac90c-8954-4796-afb7-1c0e358c3d0a',
                      mech_id: mech.id,
                      run_id: completedTrace.turn.id,
                      role: 'assistant',
                      text: recordedReply,
                      presentation: null,
                      created_at: '2026-11-02T12:00:04Z',
                      sequence: 2,
                    },
                  ],
                  has_more: false,
                  before_sequence: 1,
                }).messages
              }
              scrollRestorationId="example-conversation"
              name={mech.name}
              avatar={<AgentAvatar seed={mech.id} size="xs" />}
              controls={null}
              inspect={() => (
                <MessageAction label="Inspect run" onClick={() => setFocusedRun(true)}>
                  <ListTree size={16} aria-hidden />
                </MessageAction>
              )}
            />
            <WorkbenchFooter>
              <PromptInput
                label={`Message ${mech.name}`}
                value={draft}
                onValueChange={setDraft}
                onSubmit={(event) => event.preventDefault()}
                enterBehavior="submit"
                isCompact
              />
            </WorkbenchFooter>
          </>
        ) : (
          <WorkbenchScroll
            label={
              view === 'activity'
                ? 'History'
                : view === 'runs'
                  ? 'Runs'
                  : view === 'definition'
                    ? 'Mech settings'
                    : 'Environment'
            }
            scrollRestorationId={`story-${view}`}
            isFlush={collectionViews.has(view)}
          >
            {collectionViews.has(view) && (
              <CollectionToolbar label="Activity views">
                <PageNavigation
                  label="Activity views"
                  isEmbedded
                  items={[
                    { id: 'activity', label: 'Events', href: '#activity' },
                    { id: 'runs', label: 'Runs', href: '#runs' },
                  ]}
                  selectedId={view}
                  onNavigate={setView}
                />
              </CollectionToolbar>
            )}
            {view === 'runs' && (
              <TurnList
                page={longRunPage}
                turnHref={(id) => `?turn=${id}`}
                onOpen={() => setFocusedRun(true)}
                emptyDescription="Executions appear here."
              />
            )}
            {view === 'activity' && (
              <Activity page={{ ...completedEvents, events: completedEvents.events.toReversed() }} />
            )}
            {view === 'environment' && (
              <EnvironmentProcesses
                processes={[]}
                stopping={new Set()}
                failure={undefined}
                onStop={() => undefined}
                renderDetails={() => null}
              />
            )}
            {view === 'definition' && (
              <MechSettings
                mech={mech}
                appearance={appearance}
                onAppearance={setAppearance}
                appearanceError={undefined}
                isBusy={false}
                error={undefined}
                onEdit={() => undefined}
                onArchive={() => undefined}
              />
            )}
          </WorkbenchScroll>
        )}
      </Workbench>
    </StoryShell>
  );
}

export const ConversationWorkspace: Story = { render: () => <WorkspaceStory /> };
export const LongTitlesAndRuns: Story = { render: () => <WorkspaceStory initialView="runs" hasLongName /> };
export const HistoryWorkspace: Story = { render: () => <WorkspaceStory initialView="activity" /> };
export const MechSettingsWorkspace: Story = { render: () => <WorkspaceStory initialView="definition" /> };
