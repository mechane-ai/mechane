import { Button, CopyValue, Status } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { MediaViewer, MediaViewerPlaceholder } from '@mechane-ai/elements/content';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import type { EvidenceArtifact, EvidenceDescriptor } from '@mechane/protocol';
import { Duration, Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, preciseTimeLabel } from './format.ts';

export type EvidencePlayback = {
  readonly contentSrc: string;
  readonly mediaAttempt: number;
  readonly mediaFailure?: 'expired' | 'unavailable' | undefined;
  readonly onMediaError: () => void;
  readonly onRetryMedia: () => void;
};

type RecordedCapture = Pick<EvidenceArtifact, 'kind' | 'status' | 'descriptor' | 'failureReason'>;

export function captureLabel(kind: EvidenceArtifact['kind']): string {
  return kind === 'screenshot' ? 'Screenshot' : 'Screen recording';
}

export function CaptureStatus({ status }: { readonly status: EvidenceArtifact['status'] }): ReactNode {
  switch (status) {
    case 'ready':
      return <Status>Captured</Status>;
    case 'pending':
      return <Status>Capturing</Status>;
    case 'failed':
      return <Status tone="negative">Capture failed</Status>;
  }
}

export function CaptureMedia({
  artifact,
  ...playback
}: EvidencePlayback & { readonly artifact: RecordedCapture }): ReactNode {
  if (artifact.status === 'pending') {
    return (
      <>
        <MediaViewerPlaceholder />
        <Notice>The capture is in progress. This page updates when the capture is stored.</Notice>
      </>
    );
  }

  if (artifact.status === 'failed') {
    return (
      <Notice hasError>{Option.getOrElse(artifact.failureReason, () => 'The capture could not be stored.')}</Notice>
    );
  }

  const descriptor = Option.getOrUndefined(artifact.descriptor);

  if (descriptor === undefined) {
    return <Notice>Media details are unavailable for this capture.</Notice>;
  }

  return (
    <>
      <RecordedMedia kind={artifact.kind} descriptor={descriptor} {...playback} />
      <Details
        items={[
          { label: 'Captured', value: preciseTimeLabel(descriptor.capturedAt) },
          { label: 'Captured URL', value: descriptor.url },
          { label: 'Dimensions', value: `${descriptor.widthPixels} × ${descriptor.heightPixels} pixels` },
          ...(artifact.kind === 'recording'
            ? [{ label: 'Duration', value: durationLabel(Duration.toMillis(descriptor.duration)) }]
            : []),
          { label: 'Media', value: `${descriptor.mediaType} · ${descriptor.sizeBytes.toLocaleString('en-US')} bytes` },
          {
            label: 'Source revision',
            value:
              descriptor.provenance._tag === 'ObservedGit' ? (
                <CopyValue label="source revision" value={descriptor.provenance.head} />
              ) : (
                `Unknown: ${descriptor.provenance.reason}`
              ),
          },
          ...(descriptor.provenance._tag === 'ObservedGit'
            ? [
                {
                  label: 'Working tree',
                  value: descriptor.provenance.isDirty ? 'Uncommitted changes observed' : 'Clean at capture',
                },
                {
                  label: 'Dirty patch hash',
                  value: Option.getOrElse(descriptor.provenance.dirtyPatchSha256, () => 'Not recorded'),
                },
              ]
            : []),
          { label: 'Content hash', value: <CopyValue label="content hash" value={descriptor.sha256} /> },
        ]}
      />
    </>
  );
}

function RecordedMedia({
  kind,
  descriptor,
  contentSrc,
  mediaAttempt,
  mediaFailure,
  onMediaError,
  onRetryMedia,
}: EvidencePlayback & { readonly kind: EvidenceArtifact['kind']; readonly descriptor: EvidenceDescriptor }): ReactNode {
  switch (mediaFailure) {
    case 'expired':
      return <EmptyState title="Capture expired">The stored media has expired.</EmptyState>;
    case 'unavailable':
      return (
        <EmptyState title="Could not load the capture" action={<Button onClick={onRetryMedia}>Try again</Button>}>
          Check your connection and workspace access, then retry.
        </EmptyState>
      );
    case undefined:
      return (
        <MediaViewer
          key={mediaAttempt}
          kind={kind === 'screenshot' ? 'image' : 'video'}
          src={contentSrc}
          label={`${captureLabel(kind)} of ${descriptor.url}`}
          widthPixels={descriptor.widthPixels}
          heightPixels={descriptor.heightPixels}
          onError={onMediaError}
        />
      );
  }
}
