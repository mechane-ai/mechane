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
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Resource, ResourceView, useCollectionLifetime, useResource } from '../resource.tsx';

export function ConnectionsScreen({
  data,
  mechId,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
}): ReactNode {
  const bindings = useMemo(() => data.slackBindings(), [data]);
  const deliveries = useMemo(() => data.slackDeliveries(mechId), [data, mechId]);

  useCollectionLifetime(data, bindings);
  useCollectionLifetime(data, deliveries);

  const bindingsState = useResource(data, bindings);

  return (
    <Stack>
      <Subheading>Slack</Subheading>
      <ResourceView
        state={bindingsState}
        identity={bindings.id}
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
        <Resource
          data={data}
          source={deliveries}
          placeholder={<SlackDeliveriesPlaceholder />}
          label="Loading Slack deliveries"
        >
          {(page, notice) => (
            <>
              {notice}
              <SlackDeliveries deliveries={page.deliveries} />
            </>
          )}
        </Resource>
      </SlackDeliverySection>
    </Stack>
  );
}
