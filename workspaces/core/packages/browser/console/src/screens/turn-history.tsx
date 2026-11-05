import { Button, Row, Stack, TextButton } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import type { ConsoleData } from '@mechane/console-data';
import { Activity, ActivityPlaceholder } from '@mechane/console-views';
import type { Turn } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { PageLoadNotice, usePageSource } from '../page-source.tsx';
import { Resource } from '../resource.tsx';

export function TurnHistory({
  data,
  mechId,
  turnId,
  target,
  onStart,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly turnId: Turn['id'];
  readonly target: number | undefined;
  readonly onStart: () => void;
}): ReactNode {
  const { source, cursors, setCursors, pending, failure } = usePageSource({
    data,
    key: 'events',
    scope: `${mechId}:${turnId}:${target ?? 'start'}`,
    create: (pages) => data.turnEvents(mechId, turnId, pages.at(-1) ?? (target === undefined ? 0 : target - 1)),
  });

  const isLinkedPage = target !== undefined && cursors.length === 0;

  return (
    <Stack isCompact>
      {target !== undefined && (
        <Row>
          <TextButton onClick={onStart}>From the beginning</TextButton>
        </Row>
      )}
      <Resource data={data} source={source} placeholder={<ActivityPlaceholder hasInset={false} />}>
        {(page, notice) => {
          const hasPages = page.hasMore || cursors.length > 0;
          const showPagination = hasPages || failure !== undefined;
          const isPreviousDisabled = cursors.length === 0 || pending !== undefined;
          const isNextDisabled = !page.hasMore || pending !== undefined;

          return (
            <Stack>
              {notice}
              {isLinkedPage && page.events[0]?.sequence !== target && (
                <Notice>The linked event is unavailable in this turn.</Notice>
              )}
              <Activity page={page} label="Run events" hasInset={false} expandedSequence={target} />
              {showPagination && (
                <Stack isCompact>
                  <PageLoadNotice failure={failure} />
                  <Row shouldSpaceBetween>
                    <Button
                      isPending={pending === 'previous'}
                      pendingLabel="Loading previous events…"
                      disabled={isPreviousDisabled}
                      onClick={() => setCursors(cursors.slice(0, -1))}
                    >
                      Previous events
                    </Button>
                    <Button
                      isPending={pending === 'next'}
                      pendingLabel="Loading next events…"
                      disabled={isNextDisabled}
                      onClick={() => {
                        const last = page.events.at(-1);

                        if (last !== undefined) {
                          setCursors([...cursors, last.sequence]);
                        }
                      }}
                    >
                      Next events
                    </Button>
                  </Row>
                </Stack>
              )}
            </Stack>
          );
        }}
      </Resource>
    </Stack>
  );
}
