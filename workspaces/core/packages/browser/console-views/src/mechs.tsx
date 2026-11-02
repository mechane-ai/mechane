import type { Allowance, MechPage, MechSummary } from '@mechane/protocol';
import {
  Badge,
  Button,
  Cell,
  EmptyState,
  Heading,
  Identifier,
  Metric,
  MetricGrid,
  Muted,
  Panel,
  Row,
  Stack,
  Table,
} from '@mechane/ui';
import type { ReactNode } from 'react';
import { moneyLabel, timeLabel } from './format.ts';

export function MechList({
  page,
  allowance,
  onOpen,
  onCreate,
  onNext,
  onPrevious,
  hasPrevious,
  onRefresh,
}: {
  readonly page: MechPage;
  readonly allowance: Allowance | undefined;
  readonly onOpen: (mech: MechSummary) => void;
  readonly onCreate: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly hasPrevious: boolean;
  readonly onRefresh: () => void;
}): ReactNode {
  const active = page.mechs.filter((mech) => mech.status === 'active').length;

  return (
    <Stack>
      <Row between>
        <Stack compact>
          <Muted>WORKSPACE / MECHS</Muted>
          <Heading>Your mechs</Heading>
          <Muted>Inspect their work, follow activity, and manage what runs next.</Muted>
        </Stack>
        <Row>
          <Button onClick={onRefresh}>Refresh</Button>
          <Button tone="primary" onClick={onCreate}>
            + Create mech
          </Button>
        </Row>
      </Row>
      <MetricGrid>
        <Metric label="Mechs on this page" value={page.mechs.length} detail={<Muted>{active} active</Muted>} />
        <Metric
          label="Workspace spend today"
          value={allowance === undefined ? '—' : moneyLabel(allowance.committedMicros)}
          detail={<Muted>Settled costs and open reservations</Muted>}
        />
        <Metric
          label="Daily workspace allowance"
          value={allowance === undefined ? '—' : moneyLabel(allowance.dailyAllowanceMicros)}
          detail={<Muted>Resets at midnight UTC</Muted>}
        />
      </MetricGrid>
      <Panel padded={false}>
        {page.mechs.length === 0 ? (
          <EmptyState
            title="No mechs yet"
            action={
              <Button tone="primary" onClick={onCreate}>
                Create your first mech
              </Button>
            }
          >
            Give a mech instructions, then send it something to work on.
          </EmptyState>
        ) : (
          <Table label="Mechs" headers={['Name', 'Status', 'Model', 'Created', '']}>
            {page.mechs.map((mech) => (
              <tr key={mech.id}>
                <Cell>
                  <Stack compact>
                    <Button tone="quiet" onClick={() => onOpen(mech)}>
                      {mech.name}
                    </Button>
                    <Identifier>{mech.id}</Identifier>
                  </Stack>
                </Cell>
                <Cell>
                  <Badge tone={mech.status === 'active' ? 'positive' : 'neutral'}>{mech.status}</Badge>
                </Cell>
                <Cell>
                  <Identifier>{mech.model}</Identifier>
                  <Muted>Revision {mech.revision}</Muted>
                </Cell>
                <Cell>
                  <Muted>{timeLabel(mech.createdAt)}</Muted>
                </Cell>
                <Cell>
                  <Button tone="quiet" onClick={() => onOpen(mech)}>
                    Open →
                  </Button>
                </Cell>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <Row between>
        <Muted>{page.hasMore ? 'More mechs are available on the next page.' : 'End of this list.'}</Muted>
        <Row>
          <Button disabled={!hasPrevious} onClick={onPrevious}>
            Previous
          </Button>
          <Button disabled={!page.hasMore} onClick={onNext}>
            Next
          </Button>
        </Row>
      </Row>
    </Stack>
  );
}
