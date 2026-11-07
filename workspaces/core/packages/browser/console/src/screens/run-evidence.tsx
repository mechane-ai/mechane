import { Button, Muted, Row, Stack, Subheading } from '@mechane-ai/elements';
import type { ConsoleData } from '@mechane/console-data';
import { EvidenceList, EvidenceListPlaceholder } from '@mechane/console-views';
import type { Turn } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { EvidenceLink } from '../navigation.tsx';
import { PageLoadNotice, usePageRead } from '../page-read.tsx';
import { useEvidence } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

export function RunEvidence({
  data,
  mechId,
  turnId,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly turnId: Turn['id'];
}): ReactNode {
  const { request, cursors, setCursors, pending, failure } = usePageRead({
    data,
    key: 'evidence',
    scope: `${mechId}:${turnId}`,
    create: (pages) => data.reads.evidence(mechId, turnId, pages.at(-1) ?? null),
  });

  const state = useEvidence(data, request);

  return (
    <Stack isCompact>
      <Subheading>Browser evidence</Subheading>
      <ResourceView state={state} placeholder={<EvidenceListPlaceholder />} label="Loading browser evidence">
        {(page, notice) => {
          const hasPreviousPage = cursors.length > 0;
          const hasPendingPage = pending !== undefined;
          const shouldShowPagination = page.hasMore || hasPreviousPage || failure !== undefined;
          const isPreviousDisabled = !hasPreviousPage || hasPendingPage;
          const isNextDisabled = !page.hasMore || hasPendingPage;

          return (
            <Stack isCompact>
              {notice}
              <EvidenceList
                artifacts={page.artifacts}
                link={(artifact, label) => <EvidenceLink artifact={artifact}>{label}</EvidenceLink>}
              />
              {page.artifacts.length > 0 && (
                <Muted>Recorded observations. Captures do not establish a test result.</Muted>
              )}
              {shouldShowPagination && (
                <>
                  <Row>
                    <Button
                      disabled={isPreviousDisabled}
                      isPending={pending === 'previous'}
                      pendingLabel="Loading…"
                      onClick={() => setCursors(cursors.slice(0, -1))}
                    >
                      Previous
                    </Button>
                    <Button
                      disabled={isNextDisabled}
                      isPending={pending === 'next'}
                      pendingLabel="Loading…"
                      onClick={() => {
                        const last = page.artifacts.at(-1);

                        if (last !== undefined) {
                          setCursors([...cursors, last.artifactId]);
                        }
                      }}
                    >
                      Next
                    </Button>
                  </Row>
                  <PageLoadNotice failure={failure} />
                </>
              )}
            </Stack>
          );
        }}
      </ResourceView>
    </Stack>
  );
}
