import type { Allowance, MechPage, MechSummary } from '@mechane/protocol';
import { Button, Cell, EmptyState, ListFooter, Status, Table } from '@mechane/ui';
import type { ReactNode } from 'react';
import { ageLabel, moneyLabel, preciseTimeLabel, timeLabel } from './format.ts';

export function MechList({
  page,
  allowance,
  onOpen,
  onCreate,
  onNext,
  onPrevious,
  hasPrevious,
}: {
  readonly page: MechPage;
  readonly allowance: Allowance | undefined;
  readonly onOpen: (mech: MechSummary) => void;
  readonly onCreate: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly hasPrevious: boolean;
}): ReactNode {
  return (
    <>
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
        <Table
          label="Mechs"
          headers={[
            { label: 'Mech name', width: 30 },
            { label: 'Status', width: 15 },
            { label: 'Model', width: 25 },
            { label: 'Revision', width: 10 },
            { label: 'Created', width: 20 },
          ]}
        >
          {page.mechs.map((mech) => (
            <tr key={mech.id}>
              <Cell>
                <Button tone="link" title={`${mech.name} · ${mech.id}`} onClick={() => onOpen(mech)}>
                  {mech.name}
                </Button>
              </Cell>
              <Cell>
                <Status tone={mech.status === 'active' ? 'positive' : 'neutral'}>{mech.status}</Status>
              </Cell>
              <Cell>
                <span title={mech.model}>{mech.model}</span>
              </Cell>
              <Cell>{mech.revision}</Cell>
              <Cell>
                <time dateTime={preciseTimeLabel(mech.createdAt)} title={timeLabel(mech.createdAt)}>
                  {ageLabel(mech.createdAt)}
                </time>
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      <ListFooter
        actions={
          <>
            <Button disabled={!hasPrevious} onClick={onPrevious}>
              Previous
            </Button>
            <Button disabled={!page.hasMore} onClick={onNext}>
              Next
            </Button>
          </>
        }
      >
        {page.mechs.length} mechs on this page
        {allowance !== undefined &&
          ` · Today ${moneyLabel(allowance.committedMicros)} of ${moneyLabel(allowance.dailyAllowanceMicros)}`}
        {page.hasMore && ' · More available'}
      </ListFooter>
    </>
  );
}
