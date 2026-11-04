import {
  Button,
  Field,
  Heading,
  Input,
  Loading as LoadingRows,
  Muted,
  Notice,
  Row,
  Stack,
  TextButton,
  TextLink,
} from '@mechane-ai/ui';
import { DetailPage, NavigationLink, PageToolbar, ToolbarAction } from '@mechane-ai/ui/layout';
import type { TraceTab } from '@mechane/console-views';
import {
  Activity,
  ConsoleShell,
  MechList,
  DefinitionConflict as SavedDefinition,
  TurnTrace,
} from '@mechane/console-views';
import { Allowance, EventPage, MechPage, Trace, WorkspaceList } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Option, Schema } from 'effect';
import { Bot, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

const meta = {
  title: 'Screens/Console',
  component: ConsoleShell,
  subcomponents: { Activity, MechList, DefinitionConflict: SavedDefinition, TurnTrace },
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
      role: 'owner',
      daily_allowance_micros: 10_000_000,
      created_at: '2026-10-15T12:00:00Z',
    },
    {
      id: 'dca2ed60-d0a3-45f0-bbd1-6c7baef01512',
      name: 'Engineering',
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

const emptyPage = Schema.decodeUnknownSync(MechPage)({ mechs: [], has_more: false });

const completedTrace = Schema.decodeUnknownSync(Trace)({
  reply_excerpt: {
    sequence: 107,
    text: 'The release candidate is ready. All three packages passed their checks. The deployment can proceed once the release tag is published.',
    truncated: false,
  },
  turn: {
    id: '52d0e964-811d-44f4-a96e-d38ca5df748b',
    status: 'answered',
    inbox_item_ids: [],
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

function StoryShell({ children }: { readonly children: ReactNode }): ReactNode {
  const [workspaceId, setWorkspaceId] = useState<string>(workspaceList.workspaces[0].id);

  return (
    <ConsoleShell
      name="Jordan Lee"
      origin="https://mechane.example"
      workspaceId={workspaceId}
      workspaces={workspaceList.workspaces}
      onWorkspace={setWorkspaceId}
      homeLink={
        <NavigationLink href="#mechs" icon={<Bot size={16} />} selected>
          Mechs
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
          <ToolbarAction aria-label="Refresh mechs" onClick={() => undefined}>
            <RefreshCw size={16} aria-hidden />
          </ToolbarAction>
          <ToolbarAction icon={<Plus size={16} aria-hidden />} onClick={() => undefined}>
            Create mech
          </ToolbarAction>
        </>
      }
    />
  );
}

function MechsStory({ page }: { readonly page: MechPage }): ReactNode {
  return (
    <StoryShell>
      <MechsToolbar />
      <MechList
        hasPrevious={false}
        page={page}
        allowance={allowance}
        nameLink={(mech) => <TextLink href={`?mech=${mech.id}`}>{mech.name}</TextLink>}
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
  initialTab = 'Overview',
}: {
  readonly trace: Trace;
  readonly notice?: ReactNode;
  readonly initialTab?: TraceTab;
}): ReactNode {
  const reply = Option.getOrUndefined(trace.replyExcerpt);
  const [tab, setTab] = useState<TraceTab>(initialTab);
  const [request, setRequest] = useState<string>();

  return (
    <StoryShell>
      <PageToolbar
        breadcrumb
        title={
          <>
            <TextButton onClick={() => undefined}>Repository scout / Turns</TextButton> / Turn trace
          </>
        }
        actions={
          trace.turn.status === 'running' && <ToolbarAction onClick={() => undefined}>Cancel turn</ToolbarAction>
        }
      />
      {notice}
      <DetailPage>
        <Stack>
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
            replyLink={() => <TextButton onClick={() => setTab('Events')}>Read full reply →</TextButton>}
            events={
              <Activity
                chronological
                page={Schema.decodeUnknownSync(EventPage)({
                  has_more: false,
                  events:
                    reply === undefined
                      ? []
                      : [
                          {
                            type: 'turn.answered',
                            turn_id: trace.turn.id,
                            sequence: reply.sequence,
                            occurred_at: '2026-11-02T12:00:04Z',
                            reply: reply.text,
                          },
                        ],
                })}
              />
            }
          />
        </Stack>
      </DetailPage>
    </StoryShell>
  );
}

export const Mechs: Story = { render: () => <MechsStory page={mechPage} /> };

export const CompletedTurn: Story = { render: () => <TraceStory trace={completedTrace} /> };

export const RequestTimeline: Story = { render: () => <TraceStory trace={completedTrace} initialTab="Requests" /> };

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
        <Notice error>
          Refresh failed. Showing the last saved result. <Button>Retry refresh</Button>
        </Notice>
      }
    />
  ),
};

export const DefinitionConflict: Story = {
  render: () => (
    <StoryShell>
      <PageToolbar breadcrumb title="Repository scout / Edit definition" />
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
      <MechsToolbar />
      <LoadingRows label="Loading mechs" />
    </StoryShell>
  ),
};

const encodedTrace = Schema.encodeSync(Trace)(completedTrace);
const sampleRequest = encodedTrace.dispatches[0];

export const RefusedTurn: Story = {
  render: () => (
    <TraceStory
      trace={Schema.decodeUnknownSync(Trace)({
        turn: { ...encodedTrace.turn, status: 'unanswered', reason: 'allowance_exhausted' },
        dispatches: [{ ...sampleRequest, status: 'refused' }],
      })}
    />
  ),
};

export const RunningTurn: Story = {
  render: () => (
    <TraceStory
      trace={Schema.decodeUnknownSync(Trace)({
        turn: { ...encodedTrace.turn, status: 'running' },
        dispatches: [{ ...sampleRequest, status: 'reserved' }],
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
