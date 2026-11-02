import { MechList, TurnTrace } from '@mechane/console-views';
import { MechPage, Trace } from '@mechane/protocol';
import { Brand, Button, EmptyState, Heading, Layout, Notice, Panel, Stack, TextField } from '@mechane/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Schema } from 'effect';

const meta = { title: 'Console/States', component: Panel, args: { children: null } } satisfies Meta<typeof Panel>;
export default meta;
type Story = StoryObj<typeof meta>;

const page = Schema.decodeUnknownSync(MechPage)({
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
  ],
  has_more: false,
});

const trace = Schema.decodeUnknownSync(Trace)({
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

export const Mechs: Story = {
  render: () => (
    <Layout sidebar={<Brand />} footer={null}>
      <MechList
        page={page}
        allowance={undefined}
        hasPrevious={false}
        onOpen={() => undefined}
        onCreate={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
        onRefresh={() => undefined}
      />
    </Layout>
  ),
};

export const CompletedTurn: Story = { render: () => <TurnTrace trace={trace} /> };

export const Empty: Story = {
  render: () => (
    <Panel>
      <EmptyState title="No mechs yet" action={<Button tone="primary">Create your first mech</Button>}>
        Give a mech instructions, then send it something to work on.
      </EmptyState>
    </Panel>
  ),
};

export const FailedRefresh: Story = {
  render: () => (
    <Stack>
      <Notice error>Refresh failed. Showing the last saved result.</Notice>
      <TurnTrace trace={trace} />
    </Stack>
  ),
};

export const DefinitionConflict: Story = {
  render: () => (
    <Panel>
      <Stack>
        <Heading>Edit definition</Heading>
        <Notice error>The definition changed while you were editing. Reopen it to review the latest revision.</Notice>
        <TextField label="Name" value="Repository scout" readOnly />
        <Button>Close</Button>
      </Stack>
    </Panel>
  ),
};

export const Loading: Story = {
  render: () => (
    <Panel>
      <EmptyState title="Loading…">Reading from your Mechane installation.</EmptyState>
    </Panel>
  ),
};
