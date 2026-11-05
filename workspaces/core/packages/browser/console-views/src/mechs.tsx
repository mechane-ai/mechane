import { AgentAvatar, Button, Status } from '@mechane-ai/elements';
import type { AgentAppearance } from '@mechane-ai/elements';
import { DataTable, DataTableText, ListFooter } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import type { Allowance, MechPage, MechSummary } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { moneyLabel } from './format.ts';
import { MechPinButton } from './mech-pin.tsx';

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
  pinnedIds,
  onTogglePin,
  appearances = {},
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
  readonly pinnedIds: ReadonlySet<MechSummary['id']>;
  readonly onTogglePin: (mech: MechSummary) => void;
  readonly appearances?: Readonly<Record<string, AgentAppearance>>;
}): ReactNode {
  const showPagination = page.hasMore || hasPrevious;
  const hasRecords = page.mechs.length > 0 || hasPrevious;
  const showFooter = hasRecords && (allowance !== undefined || showPagination);

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
          {
            id: 'name',
            label: 'Mech',
            role: 'primary',
            cell: (mech) => (
              <DataTableText
                secondary={mech.model}
                leading={<AgentAvatar seed={mech.id} appearance={appearances[mech.id]} size="md" />}
              >
                {mech.name}
              </DataTableText>
            ),
          },
          {
            id: 'status',
            label: 'Availability',
            role: 'status',
            width: 120,
            cell: (mech) => (
              <Status tone={mech.status === 'active' ? 'positive' : 'neutral'}>
                {mech.status === 'active' ? 'Enabled' : mech.status === 'paused' ? 'Paused' : 'Archived'}
              </Status>
            ),
          },
          {
            id: 'pin',
            label: 'Pin',
            role: 'actions',
            width: 80,
            cell: (mech) => (
              <MechPinButton name={mech.name} pinned={pinnedIds.has(mech.id)} onToggle={() => onTogglePin(mech)} />
            ),
          },
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
          {allowance !== undefined &&
            `Today ${moneyLabel(allowance.committedMicros)} of ${moneyLabel(allowance.dailyAllowanceMicros)}`}
        </ListFooter>
      )}
    </>
  );
}
