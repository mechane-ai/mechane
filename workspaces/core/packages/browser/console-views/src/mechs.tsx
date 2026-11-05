import { AgentAvatar, Button, Stack, Status } from '@mechane-ai/elements';
import type { AgentAppearance } from '@mechane-ai/elements';
import {
  DataTable,
  DataTablePlaceholder,
  DataTableText,
  DataTableTextPlaceholder,
  ListFooter,
} from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout } from '@mechane-ai/elements/collections';
import { ButtonPlaceholder, EmptyState, Skeleton } from '@mechane-ai/elements/feedback';
import { PageToolbar } from '@mechane-ai/elements/layout';
import type { Allowance, MechPage, MechSummary } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { moneyLabel } from './format.ts';
import { MechPinButton } from './mech-pin.tsx';

const mechColumns = {
  name: { id: 'name', label: 'Mech', role: 'primary' },
  status: { id: 'status', label: 'Availability', role: 'status', width: 120 },
  pin: { id: 'pin', label: 'Pin', role: 'actions', width: 80 },
} as const satisfies Record<string, DataTableColumnLayout>;

export function MechsPagePlaceholder(): ReactNode {
  return (
    <>
      <PageToolbar
        title="Mechs"
        actions={
          <>
            <ButtonPlaceholder isIconOnly />
            <ButtonPlaceholder width="11ch" />
          </>
        }
      />
      <MechListPlaceholder />
    </>
  );
}

function MechListPlaceholder(): ReactNode {
  return (
    <DataTablePlaceholder
      columns={[
        {
          ...mechColumns.name,
          placeholder: <DataTableTextPlaceholder isSecondary leading={<Skeleton width={24} height={24} />} />,
        },
        mechColumns.status,
        { ...mechColumns.pin, placeholder: <Skeleton width={16} height={16} /> },
      ]}
    />
  );
}

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
  loadingPage,
  pageNotice,
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
  readonly loadingPage?: 'previous' | 'next' | undefined;
  readonly pageNotice?: ReactNode;
  readonly pinnedIds: ReadonlySet<MechSummary['id']>;
  readonly onTogglePin: (mech: MechSummary) => void;
  readonly appearances?: Readonly<Record<string, AgentAppearance>>;
}): ReactNode {
  const showPagination = page.hasMore || hasPrevious;
  const hasRecords = page.mechs.length > 0 || hasPrevious;
  const shouldShowFooter = allowance !== undefined || showPagination;
  const showFooter = (hasRecords && shouldShowFooter) || pageNotice !== undefined;
  const isPreviousDisabled = !hasPrevious || loadingPage !== undefined;
  const isNextDisabled = !page.hasMore || loadingPage !== undefined;

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
            ...mechColumns.name,
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
            ...mechColumns.status,
            cell: (mech) => (
              <Status tone={mech.status === 'active' ? 'positive' : 'neutral'}>
                {mech.status === 'active' ? 'Enabled' : mech.status === 'paused' ? 'Paused' : 'Archived'}
              </Status>
            ),
          },
          {
            ...mechColumns.pin,
            cell: (mech) => (
              <MechPinButton name={mech.name} isPinned={pinnedIds.has(mech.id)} onToggle={() => onTogglePin(mech)} />
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
                <Button
                  isPending={loadingPage === 'previous'}
                  pendingLabel="Loading previous mechs…"
                  disabled={isPreviousDisabled}
                  onClick={onPrevious}
                >
                  Previous
                </Button>
                <Button
                  isPending={loadingPage === 'next'}
                  pendingLabel="Loading next mechs…"
                  disabled={isNextDisabled}
                  onClick={onNext}
                >
                  Next
                </Button>
              </>
            ) : undefined
          }
        >
          <Stack isCompact>
            {pageNotice}
            {allowance !== undefined &&
              `Today ${moneyLabel(allowance.committedMicros)} of ${moneyLabel(allowance.dailyAllowanceMicros)}`}
          </Stack>
        </ListFooter>
      )}
    </>
  );
}
