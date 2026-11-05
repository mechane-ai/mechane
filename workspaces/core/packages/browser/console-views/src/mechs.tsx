import { Button, Status } from '@mechane-ai/elements';
import { DataTable, ListFooter } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import type { Allowance, MechPage, MechSummary } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { moneyLabel, timeLabel } from './format.ts';

export function MechList({
  page,
  allowance,
  mechHref,
  onOpen,
  focusRowId,
  onCreate,
  onNext,
  onPrevious,
  hasPrevious,
}: {
  readonly page: MechPage;
  readonly allowance: Allowance | undefined;
  readonly mechHref: (mech: MechSummary) => string;
  readonly onOpen: (mech: MechSummary) => void;
  readonly focusRowId?: string | undefined;
  readonly onCreate: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly hasPrevious: boolean;
}): ReactNode {
  const showFooter = page.mechs.length > 0 || hasPrevious;
  const showPagination = page.hasMore || hasPrevious;

  return (
    <>
      <DataTable
        caption="Mechs"
        hideCaption
        rows={page.mechs}
        getRowId={(mech) => mech.id}
        focusRowId={focusRowId}
        rowAction={{ href: mechHref, onActivate: onOpen, label: (mech) => `Open ${mech.name}` }}
        columns={[
          { id: 'name', label: 'Mech', cell: (mech) => mech.name, truncate: true },
          {
            id: 'status',
            label: 'Availability',
            cell: (mech) => (
              <Status tone={mech.status === 'active' ? 'positive' : 'neutral'}>
                {mech.status === 'active' ? 'Enabled' : mech.status === 'paused' ? 'Paused' : 'Archived'}
              </Status>
            ),
          },
          { id: 'model', label: 'Model', secondary: true, cell: (mech) => mech.model },
          { id: 'created', label: 'Created', secondary: true, cell: (mech) => timeLabel(mech.createdAt) },
        ]}
        empty={
          <EmptyState
            title="No mechs yet"
            action={
              <Button variant="solid" onClick={onCreate}>
                Create your first mech
              </Button>
            }
          >
            Give a mech instructions, then start a conversation.
          </EmptyState>
        }
      />
      {showFooter && (
        <ListFooter
          actions={
            showPagination ? (
              <>
                <Button disabled={!hasPrevious} onClick={onPrevious}>
                  Previous
                </Button>
                <Button disabled={!page.hasMore} onClick={onNext}>
                  Next
                </Button>
              </>
            ) : undefined
          }
        >
          {page.mechs.length} {page.mechs.length === 1 ? 'mech' : 'mechs'}
          {allowance !== undefined &&
            ` · Today ${moneyLabel(allowance.committedMicros)} of ${moneyLabel(allowance.dailyAllowanceMicros)}`}
        </ListFooter>
      )}
    </>
  );
}
