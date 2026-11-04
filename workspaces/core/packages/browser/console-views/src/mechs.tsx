import { Button, CopyValue, EmptyState, Status } from '@mechane-ai/ui';
import { Cell, ListFooter, Table } from '@mechane-ai/ui/collections';
import type { Allowance, MechPage, MechSummary } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { moneyLabel, preciseTimeLabel, timeLabel } from './format.ts';

export function MechList({
  page,
  allowance,
  nameLink,
  onCreate,
  onNext,
  onPrevious,
  hasPrevious,
}: {
  readonly page: MechPage;
  readonly allowance: Allowance | undefined;
  readonly nameLink: (mech: MechSummary) => ReactNode;
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
            <Button variant="solid" onClick={onCreate}>
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
            { label: 'Model', width: 25, secondary: true },
            { label: 'Revision', width: 10, secondary: true },
            { label: 'Created', width: 20, secondary: true },
          ]}
        >
          {page.mechs.map((mech) => (
            <tr key={mech.id}>
              <Cell mobileLabel={mech.model}>{nameLink(mech)}</Cell>
              <Cell>
                <Status tone={mech.status === 'active' ? 'positive' : 'neutral'}>{mech.status}</Status>
              </Cell>
              <Cell secondary>
                <span title={mech.model}>{mech.model}</span>
              </Cell>
              <Cell secondary>{mech.revision}</Cell>
              <Cell secondary>
                <CopyValue label={`${mech.name} creation time in UTC`} value={preciseTimeLabel(mech.createdAt)}>
                  {timeLabel(mech.createdAt)}
                </CopyValue>
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
        {page.mechs.length} {page.mechs.length === 1 ? 'mech' : 'mechs'} on this page
        {allowance !== undefined &&
          ` · Today ${moneyLabel(allowance.committedMicros)} of ${moneyLabel(allowance.dailyAllowanceMicros)}`}
        {page.hasMore && ' · More available'}
      </ListFooter>
    </>
  );
}
