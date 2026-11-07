import { Button, CopyValue, Stack } from '@mechane-ai/elements';
import { PageToolbar, ToolbarAction, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { ConsoleData } from '@mechane/console-data';
import { EvidenceDetails, EvidenceDetailsPlaceholder } from '@mechane/console-views';
import { evidenceContentPath, evidenceViewerPath } from '@mechane/protocol';
import type { EvidenceArtifact } from '@mechane/protocol';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { Option } from 'effect';
import { ArrowLeft } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useReaderPosition } from '../navigation.tsx';
import { ResourceView } from '../resource.tsx';
import type { ResourceState } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';

type EvidenceScreenProps = ConsoleNavigation & {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly mechName: string;
  readonly state: ResourceState<EvidenceArtifact>;
  readonly notice: ReactNode;
};

export function EvidenceScreen({ data, mechId, mechName, location, state, notice }: EvidenceScreenProps): ReactNode {
  const router = useRouter();
  const origin = useRouterState({ select: (routerState) => routerState.location.state.consoleEvidenceOrigin });
  const back = useRef<HTMLButtonElement>(null);
  const reader = useReaderPosition(data.scope, `${mechId}:evidence:${location.artifact ?? ''}`);

  useLayoutEffect(() => {
    back.current?.focus({ preventScroll: true });
  }, []);

  function returnToRun(): void {
    if (origin !== undefined) {
      router.history.back();

      return;
    }

    const turn = state.kind === 'ready' ? Option.getOrUndefined(state.value.turnId) : undefined;
    const session = state.kind === 'ready' ? state.value.sessionId : undefined;

    void router.navigate({
      to: '/',
      search: {
        workspace: data.workspace.id,
        mech: mechId,
        ...(session === undefined ? {} : { session }),
        ...(turn === undefined ? {} : { turn }),
      },
      replace: true,
      resetScroll: false,
      state: () => ({}),
    });
  }

  return (
    <>
      <PageToolbar
        showNavigation={false}
        title={`Evidence · ${mechName}`}
        leading={
          <ToolbarAction ref={back} icon={<ArrowLeft size={16} aria-hidden />} onClick={returnToRun}>
            Back
          </ToolbarAction>
        }
        actions={
          state.kind === 'ready' ? (
            <CopyValue
              label="evidence link"
              value={new URL(evidenceViewerPath(state.value), globalThis.location.origin).href}
            >
              Copy link
            </CopyValue>
          ) : undefined
        }
      />
      <Workbench>
        <WorkbenchScroll label="Evidence" scrollRestorationId={reader.id}>
          {notice}
          <ResourceView state={state} placeholder={<EvidenceDetailsPlaceholder />} label="Loading evidence">
            {(artifact, refreshNotice) => (
              <Stack>
                {refreshNotice}
                <CapturedEvidence key={artifact.artifactId} data={data} artifact={artifact} onOpenRun={returnToRun} />
              </Stack>
            )}
          </ResourceView>
        </WorkbenchScroll>
      </Workbench>
    </>
  );
}

function CapturedEvidence({
  data,
  artifact,
  onOpenRun,
}: {
  readonly data: ConsoleData;
  readonly artifact: EvidenceArtifact;
  readonly onOpenRun: () => void;
}): ReactNode {
  const [hasMediaFailed, setMediaFailed] = useState(false);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const turn = Option.getOrUndefined(artifact.turnId);

  function refreshArtifact(): void {
    void Promise.allSettled([data.refresh(data.reads.evidenceArtifact(artifact.mechId, artifact.artifactId))]);
  }

  return (
    <EvidenceDetails
      artifact={artifact}
      contentSrc={evidenceContentPath(artifact)}
      hasMediaFailed={hasMediaFailed}
      mediaAttempt={mediaAttempt}
      onMediaError={() => {
        setMediaFailed(true);
        refreshArtifact();
      }}
      onRetryMedia={() => {
        setMediaFailed(false);
        setMediaAttempt((attempt) => attempt + 1);
        refreshArtifact();
      }}
      runLink={
        turn === undefined ? null : (
          <Button variant="ghost" onClick={onOpenRun}>
            Open run
          </Button>
        )
      }
    />
  );
}
