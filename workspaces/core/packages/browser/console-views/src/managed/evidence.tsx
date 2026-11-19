import { CopyValue, Row, Stack, Subheading } from '@mechane-ai/elements';
import { DataTable, DataTablePlaceholder, DataTableText, Details } from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout } from '@mechane-ai/elements/collections';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import type { ConsoleSessionEvidenceArtifact } from '@mechane/protocol';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { captureLabel, CaptureMedia, CaptureStatus } from '../evidence-capture.tsx';
import type { EvidencePlayback } from '../evidence-capture.tsx';
import { preciseTimeLabel } from '../format.ts';
import { ConsoleTimestamp } from '../record-time.tsx';

const columns = [
  { id: 'capture', label: 'Capture', role: 'primary' },
  { id: 'status', label: 'Status', role: 'status', width: 140 },
  { id: 'requested', label: 'Requested', role: 'timestamp', width: 190, isSecondary: true },
] as const satisfies ReadonlyArray<DataTableColumnLayout>;

export function ManagedEvidenceListPlaceholder(): ReactNode {
  return <DataTablePlaceholder caption="Session evidence" columns={columns} />;
}

export function ManagedEvidenceList({
  artifacts,
  href,
  onOpen,
  focusRowId,
}: {
  readonly artifacts: ReadonlyArray<ConsoleSessionEvidenceArtifact>;
  readonly href: (artifactId: ConsoleSessionEvidenceArtifact['artifactId']) => string;
  readonly onOpen: (artifactId: ConsoleSessionEvidenceArtifact['artifactId']) => void;
  readonly focusRowId?: string | undefined;
}): ReactNode {
  return (
    <DataTable
      caption="Session evidence"
      hideCaption
      rows={artifacts}
      getRowId={(artifact) => artifact.artifactId}
      focusRowId={focusRowId}
      rowAction={{
        href: (artifact) => href(artifact.artifactId),
        onActivate: (artifact) => onOpen(artifact.artifactId),
        label: (artifact) =>
          `Open ${captureLabel(artifact.kind).toLowerCase()} from ${preciseTimeLabel(artifact.createdAt)}`,
      }}
      columns={[
        {
          ...columns[0],
          cell: (artifact) => (
            <DataTableText secondary={Option.getOrUndefined(artifact.descriptor)?.url}>
              {captureLabel(artifact.kind)}
            </DataTableText>
          ),
        },
        { ...columns[1], cell: (artifact) => <CaptureStatus status={artifact.status} /> },
        { ...columns[2], cell: (artifact) => <ConsoleTimestamp value={artifact.createdAt} /> },
      ]}
      empty={<EmptyState title="No captures in this session" />}
    />
  );
}

export function ManagedEvidenceDetails({
  artifact,
  ...playback
}: EvidencePlayback & { readonly artifact: ConsoleSessionEvidenceArtifact }): ReactNode {
  const origin = artifact.origin;

  return (
    <Stack>
      <Row>
        <Subheading>{captureLabel(artifact.kind)}</Subheading>
        <CaptureStatus status={artifact.status} />
      </Row>
      <CaptureMedia artifact={artifact} {...playback} />
      <Details
        items={[
          { label: 'Artifact ID', value: <CopyValue label="artifact ID" value={artifact.artifactId} /> },
          { label: 'Requested', value: preciseTimeLabel(artifact.createdAt) },
        ]}
      />
      {origin === undefined ? (
        <Notice>Execution origin was not recorded.</Notice>
      ) : (
        <Details
          items={[
            { label: 'Workspace', value: <CopyValue label="workspace ID" value={origin.workspaceId} /> },
            { label: 'Environment', value: <CopyValue label="environment ID" value={origin.environmentId} /> },
            { label: 'Session', value: <CopyValue label="session ID" value={origin.sessionId} /> },
            { label: 'Work', value: <CopyValue label="work ID" value={origin.workId} /> },
            { label: 'Generation', value: String(origin.generation) },
            { label: 'Action', value: <CopyValue label="action ID" value={origin.actionId} /> },
          ]}
        />
      )}
    </Stack>
  );
}
