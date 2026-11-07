import { Button, CopyValue, Muted, Row, Stack, Status, Subheading } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { MediaViewer, MediaViewerPlaceholder } from '@mechane-ai/elements/content';
import { ButtonPlaceholder, EmptyState, Notice, SkeletonText } from '@mechane-ai/elements/feedback';
import { PageToolbar, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { EvidenceArtifact } from '@mechane/protocol';
import { Duration, Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, preciseTimeLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';

type EvidenceDetailsProps = {
  readonly artifact: EvidenceArtifact;
  readonly contentSrc: string;
  readonly hasMediaFailed: boolean;
  readonly mediaAttempt: number;
  readonly onMediaError: () => void;
  readonly onRetryMedia: () => void;
  readonly runLink: ReactNode;
};

export function EvidenceDetails({
  artifact,
  contentSrc,
  hasMediaFailed,
  mediaAttempt,
  onMediaError,
  onRetryMedia,
  runLink,
}: EvidenceDetailsProps): ReactNode {
  const descriptor = Option.getOrUndefined(artifact.descriptor);
  const turnId = Option.getOrUndefined(artifact.turnId);
  const kind = artifact.kind === 'screenshot' ? 'Screenshot' : 'Screen recording';

  return (
    <Stack>
      <Row shouldSpaceBetween>
        <Row>
          <Subheading>{kind}</Subheading>
          <Status tone={artifact.status === 'failed' ? 'negative' : 'neutral'}>
            {artifact.status === 'ready' ? 'Captured' : artifact.status === 'failed' ? 'Capture failed' : 'Capturing'}
          </Status>
        </Row>
        {runLink}
      </Row>
      {artifact.status === 'pending' && (
        <>
          <MediaViewerPlaceholder />
          <Notice>The capture is in progress. This page updates when the capture is stored.</Notice>
        </>
      )}
      {artifact.status === 'failed' && (
        <Notice hasError>{Option.getOrElse(artifact.failureReason, () => 'The capture could not be stored.')}</Notice>
      )}
      {artifact.status === 'ready' && descriptor !== undefined && (
        <>
          {hasMediaFailed ? (
            <EmptyState title="Could not load the capture" action={<Button onClick={onRetryMedia}>Try again</Button>}>
              Check your connection and workspace access, then retry.
            </EmptyState>
          ) : (
            <MediaViewer
              key={mediaAttempt}
              kind={artifact.kind === 'screenshot' ? 'image' : 'video'}
              src={contentSrc}
              label={`${kind} of ${descriptor.url}`}
              widthPixels={descriptor.widthPixels}
              heightPixels={descriptor.heightPixels}
              onError={onMediaError}
            />
          )}
          <Details
            items={[
              { label: 'Captured', value: preciseTimeLabel(descriptor.capturedAt) },
              { label: 'Captured URL', value: descriptor.url },
              { label: 'Dimensions', value: `${descriptor.widthPixels} × ${descriptor.heightPixels} pixels` },
              ...(artifact.kind === 'recording'
                ? [{ label: 'Duration', value: durationLabel(Duration.toMillis(descriptor.duration)) }]
                : []),
              {
                label: 'Media',
                value: `${descriptor.mediaType} · ${descriptor.sizeBytes.toLocaleString('en-US')} bytes`,
              },
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
      )}
      <Details
        items={[
          { label: 'Artifact ID', value: <CopyValue label="artifact ID" value={artifact.artifactId} /> },
          ...(turnId === undefined ? [] : [{ label: 'Run ID', value: <CopyValue label="run ID" value={turnId} /> }]),
          { label: 'Requested', value: preciseTimeLabel(artifact.createdAt) },
        ]}
      />
      <Muted>Sharing this link does not grant access. Reviewers must be members of this workspace.</Muted>
    </Stack>
  );
}

export function EvidencePagePlaceholder(): ReactNode {
  return (
    <>
      <PageToolbar
        showNavigation={false}
        title={<SkeletonText width="20ch" />}
        leading={<ButtonPlaceholder width="6ch" />}
      />
      <Workbench>
        <WorkbenchScroll label="Evidence">
          <EvidenceDetailsPlaceholder />
        </WorkbenchScroll>
      </Workbench>
    </>
  );
}

export function EvidenceDetailsPlaceholder(): ReactNode {
  return (
    <Stack>
      <Row shouldSpaceBetween>
        <Subheading>
          <SkeletonText width="24ch" />
        </Subheading>
        <ButtonPlaceholder width="8ch" />
      </Row>
      <MediaViewerPlaceholder />
      <SkeletonText lines={4} />
    </Stack>
  );
}

type EvidenceListProps = {
  readonly artifacts: ReadonlyArray<EvidenceArtifact>;
  readonly link: (artifact: EvidenceArtifact, label: string) => ReactNode;
};

export function EvidenceList({ artifacts, link }: EvidenceListProps): ReactNode {
  return (
    <Stack isCompact>
      {artifacts.length === 0 && <Muted>No captures recorded for this run.</Muted>}
      {artifacts.map((artifact) => (
        <Row key={artifact.artifactId} shouldSpaceBetween>
          <Row>
            {link(artifact, artifact.kind === 'screenshot' ? 'Screenshot' : 'Screen recording')}
            <ConsoleTimestamp value={artifact.createdAt} />
          </Row>
          <Status tone={artifact.status === 'failed' ? 'negative' : 'neutral'}>
            {artifact.status === 'ready' ? 'Captured' : artifact.status === 'failed' ? 'Capture failed' : 'Capturing'}
          </Status>
        </Row>
      ))}
    </Stack>
  );
}

export function EvidenceListPlaceholder(): ReactNode {
  return <SkeletonText lines={2} />;
}
