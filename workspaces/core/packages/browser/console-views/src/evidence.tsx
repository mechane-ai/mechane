import { CopyValue, Muted, Row, Stack, Subheading } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { MediaViewerPlaceholder } from '@mechane-ai/elements/content';
import { ButtonPlaceholder, SkeletonText } from '@mechane-ai/elements/feedback';
import { PageLayout, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { EvidenceArtifact } from '@mechane/protocol';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { captureLabel, CaptureMedia, CaptureStatus } from './evidence-capture.tsx';
import { preciseTimeLabel } from './format.ts';
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
  const turnId = Option.getOrUndefined(artifact.turnId);
  const kind = captureLabel(artifact.kind);

  return (
    <Stack>
      <Row shouldSpaceBetween>
        <Row>
          <Subheading>{kind}</Subheading>
          <CaptureStatus status={artifact.status} />
        </Row>
        {runLink}
      </Row>
      <CaptureMedia
        artifact={artifact}
        contentSrc={contentSrc}
        mediaAttempt={mediaAttempt}
        mediaFailure={hasMediaFailed ? 'unavailable' : undefined}
        onMediaError={onMediaError}
        onRetryMedia={onRetryMedia}
      />
      <Details
        items={[
          { label: 'Artifact ID', value: <CopyValue label="artifact ID" value={artifact.artifactId} /> },
          ...(turnId === undefined ? [] : [{ label: 'Run ID', value: <CopyValue label="run ID" value={turnId} /> }]),
          { label: 'Requested', value: preciseTimeLabel(artifact.createdAt) },
        ]}
      />
      <Muted>Opening this archived capture requires workspace owner access.</Muted>
    </Stack>
  );
}

export function EvidencePagePlaceholder(): ReactNode {
  return (
    <PageLayout
      showNavigation={false}
      title={<SkeletonText width="20ch" />}
      leading={<ButtonPlaceholder width="6ch" />}
    >
      <Workbench>
        <WorkbenchScroll label="Evidence">
          <EvidenceDetailsPlaceholder />
        </WorkbenchScroll>
      </Workbench>
    </PageLayout>
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
            {link(artifact, captureLabel(artifact.kind))}
            <ConsoleTimestamp value={artifact.createdAt} />
          </Row>
          <CaptureStatus status={artifact.status} />
        </Row>
      ))}
    </Stack>
  );
}

export function EvidenceListPlaceholder(): ReactNode {
  return <SkeletonText lines={2} />;
}
