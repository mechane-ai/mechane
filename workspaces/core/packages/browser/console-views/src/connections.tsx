import { Collapsible, Muted, Row, Stack, Status, TextLink } from '@mechane-ai/elements';
import { DataTable, DataTablePlaceholder } from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout } from '@mechane-ai/elements/collections';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import { slackChannelUrl } from '@mechane/protocol';
import type { SlackBinding, SlackDelivery } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { timeLabel } from './format.ts';

const deliveryColumns = {
  status: { id: 'status', label: 'Delivery', role: 'status' },
  created: { id: 'created', label: 'Created', role: 'timestamp' },
} as const satisfies Record<string, DataTableColumnLayout>;

export function SlackConnectionsPlaceholder(): ReactNode {
  return (
    <Row shouldSpaceBetween>
      <SkeletonText width="18ch" />
      <SkeletonText width="24ch" />
    </Row>
  );
}

export function SlackConnections({ bindings }: { readonly bindings: ReadonlyArray<SlackBinding> }): ReactNode {
  return (
    <Stack isCompact>
      {bindings.map((binding) => (
        <Row key={binding.id} shouldSpaceBetween>
          <TextLink
            href={slackChannelUrl({ teamId: binding.teamId, channelId: binding.channelId })}
            target="_blank"
            rel="noreferrer"
          >
            Open Slack channel ↗
          </TextLink>
          <Muted>
            {binding.isListening ? 'Listening' : 'Listening off'} ·{' '}
            {binding.isReplyEnabled ? 'Replies on' : 'Replies off'}
          </Muted>
        </Row>
      ))}
      {bindings.length === 0 && <Muted>No Slack channel is connected to this mech.</Muted>}
    </Stack>
  );
}

export function SlackDeliverySection({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger>Recent Slack deliveries</Collapsible.Trigger>
      <Collapsible.Panel keepMounted>
        <Stack isCompact>
          <Muted>
            These are delivery receipts. An agent reply and a confirmed Slack delivery are separate outcomes.
          </Muted>
          {children}
        </Stack>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function SlackDeliveriesPlaceholder(): ReactNode {
  return <DataTablePlaceholder columns={Object.values(deliveryColumns)} />;
}

export function SlackDeliveries({ deliveries }: { readonly deliveries: ReadonlyArray<SlackDelivery> }): ReactNode {
  if (deliveries.length === 0) {
    return <Muted>No recent Slack deliveries.</Muted>;
  }

  return (
    <DataTable
      caption="Slack delivery receipts"
      hideCaption
      rows={deliveries}
      getRowId={(receipt) => receipt.id}
      columns={[
        {
          ...deliveryColumns.status,
          cell: (receipt) => (
            <Status
              tone={receipt.status === 'sent' ? 'positive' : receipt.status === 'blocked' ? 'negative' : 'neutral'}
            >
              {receipt.status}
            </Status>
          ),
        },
        { ...deliveryColumns.created, cell: (receipt) => timeLabel(receipt.createdAt) },
      ]}
      empty="No delivery receipts"
    />
  );
}
