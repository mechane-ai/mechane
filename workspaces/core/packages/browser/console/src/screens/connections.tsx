import { Button, Row, Stack, Subheading, Text } from '@mechane-ai/elements';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import {
  SlackConnections,
  SlackConnectionsPlaceholder,
  SlackDeliveries,
  SlackDeliveriesPlaceholder,
  SlackDeliverySection,
} from '@mechane/console-views';
import type { ReactNode } from 'react';
import { useSlackBindings, useSlackDeliveries } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

export function ConnectionsScreen({
  data,
  mechId,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
}): ReactNode {
  const bindingsState = useSlackBindings(data, data.reads.slackBindings());
  const deliveriesState = useSlackDeliveries(data, data.reads.slackDeliveries(mechId));

  return (
    <Stack>
      <Subheading>Slack</Subheading>
      <ResourceView
        state={bindingsState}
        placeholder={<SlackConnectionsPlaceholder />}
        label="Loading Slack connections"
        failure={
          bindingsState.kind === 'failed' ? (
            <Row>
              <Text tone="muted" role="alert">
                {problemMessage(bindingsState.problem)}
              </Text>
              <Button
                variant="ghost"
                onClick={bindingsState.retry}
                isPending={bindingsState.isRetrying}
                pendingLabel="Retrying connections…"
              >
                Retry connections
              </Button>
            </Row>
          ) : undefined
        }
      >
        {(page, notice) => (
          <Stack isCompact>
            {notice}
            <SlackConnections bindings={page.bindings.filter((binding) => binding.mechId === mechId)} />
          </Stack>
        )}
      </ResourceView>
      <SlackDeliverySection>
        <ResourceView
          state={deliveriesState}
          placeholder={<SlackDeliveriesPlaceholder />}
          label="Loading Slack deliveries"
        >
          {(page, notice) => (
            <>
              {notice}
              <SlackDeliveries deliveries={page.deliveries} />
            </>
          )}
        </ResourceView>
      </SlackDeliverySection>
    </Stack>
  );
}
