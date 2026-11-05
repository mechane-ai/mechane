import { Muted, Row, Stack, Status, Subheading, TextLink } from '@mechane-ai/elements';
import { DataTable } from '@mechane-ai/elements/collections';
import type { ConsoleData } from '@mechane/console-data';
import { timeLabel } from '@mechane/console-views';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Resource } from '../resource.tsx';

export function ConnectionsScreen({
  data,
  mechId,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
}): ReactNode {
  const bindings = useMemo(() => data.slackBindings(), [data]);
  const deliveries = useMemo(() => data.slackDeliveries(mechId), [data, mechId]);

  return (
    <Stack>
      <Subheading>Slack</Subheading>
      <Resource data={data} source={bindings}>
        {(page, notice) => (
          <Stack compact>
            {notice}
            {page.bindings
              .filter((binding) => binding.mechId === mechId)
              .map((binding) => (
                <Row key={binding.id} between>
                  <TextLink
                    href={`https://app.slack.com/client/${encodeURIComponent(binding.teamId)}/${encodeURIComponent(binding.channelId)}`}
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
            {!page.bindings.some((binding) => binding.mechId === mechId) && (
              <Muted>No Slack channel is connected to this mech.</Muted>
            )}
          </Stack>
        )}
      </Resource>
      <Resource data={data} source={deliveries}>
        {(page, notice) => (
          <>
            {notice}
            {page.deliveries.length > 0 && (
              <Stack compact>
                <Subheading>Recent Slack deliveries</Subheading>
                <Muted>
                  These are delivery receipts. An agent reply and a confirmed Slack delivery are separate outcomes.
                </Muted>
                <DataTable
                  caption="Slack delivery receipts"
                  hideCaption
                  rows={page.deliveries}
                  getRowId={(receipt) => receipt.id}
                  columns={[
                    {
                      id: 'status',
                      label: 'Delivery',
                      cell: (receipt) => (
                        <Status
                          tone={
                            receipt.status === 'sent'
                              ? 'positive'
                              : receipt.status === 'blocked'
                                ? 'negative'
                                : 'neutral'
                          }
                        >
                          {receipt.status}
                        </Status>
                      ),
                    },
                    { id: 'created', label: 'Created', cell: (receipt) => timeLabel(receipt.createdAt) },
                  ]}
                  empty="No delivery receipts"
                />
              </Stack>
            )}
          </>
        )}
      </Resource>
    </Stack>
  );
}
