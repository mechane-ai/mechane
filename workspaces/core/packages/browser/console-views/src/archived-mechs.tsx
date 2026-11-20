import { DataTable, DataTablePlaceholder, DataTableText } from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import type { MechSummary } from '@mechane/protocol';
import type { ReactNode } from 'react';

const columns = [
  { id: 'name', label: 'Mech', role: 'primary' },
  { id: 'status', label: 'Status', role: 'status' },
  { id: 'revision', label: 'Revision', role: 'number', width: 96 },
] as const satisfies ReadonlyArray<DataTableColumnLayout>;

export function ArchivedMechListPlaceholder(): ReactNode {
  return <DataTablePlaceholder caption="Mech archive" columns={columns} />;
}

export function ArchivedMechList({
  mechs,
  href,
  onOpen,
  focusRowId,
}: {
  readonly mechs: ReadonlyArray<MechSummary>;
  readonly href: (id: string) => string;
  readonly onOpen: (id: string) => void;
  readonly focusRowId?: string | undefined;
}): ReactNode {
  return (
    <DataTable
      query={{ mode: 'frame' }}
      caption="Mech archive"
      hideCaption
      rows={mechs}
      getRowId={(mech) => mech.id}
      focusRowId={focusRowId}
      rowAction={{
        href: (mech) => href(mech.id),
        onActivate: (mech) => onOpen(mech.id),
        label: (mech) => `Inspect ${mech.name}`,
      }}
      columns={[
        { ...columns[0], cell: (mech) => <DataTableText secondary={mech.model}>{mech.name}</DataTableText> },
        { ...columns[1], cell: (mech) => <DataTableText>{mech.status}</DataTableText> },
        { ...columns[2], cell: (mech) => mech.revision },
      ]}
      empty={<EmptyState title="No historical mechs" />}
    />
  );
}
