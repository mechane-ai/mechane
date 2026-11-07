import { Button, Stack, TextLink } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { PageToolbar, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import {
  EvidenceDetails,
  EvidenceDetailsPlaceholder,
  EvidenceList,
  EvidenceListPlaceholder,
  EvidencePagePlaceholder,
} from '@mechane/console-views';
import { EvidenceArtifact } from '@mechane/protocol';
import { EvidenceArtifactId } from '@mechane/records';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Option, Schema } from 'effect';
import type { ReactNode } from 'react';
import { ResourceView } from '../resource.tsx';

const sampleScreen = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#f5f5f5"/><rect x="32" y="32" width="896" height="476" rx="8" fill="white"/><text x="64" y="88" font-family="sans-serif" font-size="28" fill="#222">Example application</text><text x="64" y="144" font-family="sans-serif" font-size="20" fill="#555">Synthetic browser capture for component documentation</text><rect x="64" y="192" width="832" height="240" rx="4" fill="#e3edff"/><text x="88" y="240" font-family="sans-serif" font-size="20" fill="#244a8f">Preview is ready for review</text></svg>')}`;

const capture = Schema.decodeUnknownSync(EvidenceArtifact)({
  artifact_id: '9d40bf13-34de-4f21-a716-b46651e356e9',
  workspace_id: '7b9baf0e-0303-40cd-a385-07bf95c6c8af',
  mech_id: 'ff1a96eb-1ad6-47d3-9a15-78b855877f10',
  session_id: '3f783d88-3b2c-4299-812d-569d8694152b',
  execution_id: 'c5deff54-c325-46b6-badf-3538b5e83270',
  tool_call_id: 'capture-example',
  turn_id: '55da1c55-b1b1-467c-aa44-ad81455724ed',
  kind: 'screenshot',
  status: 'ready',
  created_at: '2026-11-07T12:00:00Z',
  completed_at: '2026-11-07T12:00:02Z',
  failure_reason: null,
  descriptor: {
    machine_id: '23b441b3-0753-445c-93b2-28255fe40964',
    path: '/workspace/evidence/example.png',
    media_type: 'image/png',
    size_bytes: 24_320,
    sha256: 'a'.repeat(64),
    width_pixels: 960,
    height_pixels: 540,
    duration: 0,
    tab_id: 'example-tab',
    url: 'http://localhost:3000/review/a-long-record-name-that-still-needs-to-wrap-without-hiding-the-tested-destination',
    captured_at: '2026-11-07T12:00:01Z',
    provenance: {
      _tag: 'ObservedGit',
      repositoryPath: '/workspace/application',
      head: 'c'.repeat(40),
      isDirty: true,
      dirtyPatchSha256: 'b'.repeat(64),
    },
  },
});

const pending: EvidenceArtifact = {
  ...capture,
  status: 'pending',
  descriptor: Option.none(),
  completedAt: Option.none(),
};

const failed: EvidenceArtifact = {
  ...pending,
  status: 'failed',
  failureReason: Option.some('Recording stopped before the capture could be stored.'),
};

const meta = {
  title: 'Screens/Evidence',
  component: EvidenceDetails,
  subcomponents: { EvidenceDetailsPlaceholder, EvidenceList, EvidenceListPlaceholder, EvidencePagePlaceholder },
  tags: ['!supported'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Evidence records browser observations and their source provenance. The application supplies authenticated content URLs, access checks, run links, media failure and retry. Capturing and failed records do not expose playback. Native video controls provide playback and seeking. A capture does not establish a passing test, and sharing a viewer URL does not grant workspace access.',
      },
    },
  },
} satisfies Meta<typeof EvidenceDetails>;

export default meta;
type Story = StoryObj;

function Example({
  artifact = capture,
  hasMediaFailed = false,
  notice,
}: {
  readonly artifact?: EvidenceArtifact;
  readonly hasMediaFailed?: boolean;
  readonly notice?: ReactNode;
}): ReactNode {
  return (
    <>
      <PageToolbar
        showNavigation={false}
        title="Evidence · Example mech"
        leading={<Button variant="ghost">Back</Button>}
      />
      <Workbench>
        <WorkbenchScroll label="Evidence">
          <Stack>
            {notice}
            <EvidenceDetails
              artifact={artifact}
              contentSrc={sampleScreen}
              hasMediaFailed={hasMediaFailed}
              mediaAttempt={0}
              onMediaError={() => undefined}
              onRetryMedia={() => undefined}
              runLink={<TextLink href="#run">Open run</TextLink>}
            />
          </Stack>
        </WorkbenchScroll>
      </Workbench>
    </>
  );
}

export const Screenshot: Story = { render: () => <Example /> };
export const Capturing: Story = { render: () => <Example artifact={pending} /> };
export const CaptureFailed: Story = { render: () => <Example artifact={failed} /> };
export const MediaFailed: Story = { render: () => <Example hasMediaFailed /> };

export const RefreshFailed: Story = {
  render: () => (
    <Example
      notice={
        <Notice hasError>
          Showing the last result. Refresh failed. <Button>Retry refresh</Button>
        </Notice>
      }
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <ResourceView state={{ kind: 'pending' }} label="Loading evidence" placeholder={<EvidencePagePlaceholder />}>
      {() => null}
    </ResourceView>
  ),
};

export const RunCaptures: Story = {
  render: () => (
    <EvidenceList
      artifacts={[
        capture,
        { ...pending, artifactId: EvidenceArtifactId.make('6d83033a-b190-4913-b043-4fd553b097bf') },
        { ...failed, artifactId: EvidenceArtifactId.make('3fbc9d31-0308-49d6-b818-4354d991d6a2') },
      ]}
      link={(artifact, label) => <TextLink href={`#${artifact.artifactId}`}>{label}</TextLink>}
    />
  ),
};

export const NoCaptures: Story = { render: () => <EvidenceList artifacts={[]} link={() => null} /> };
