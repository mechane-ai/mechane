import { Button, Row } from '@mechane-ai/elements';
import { MessageAction } from '@mechane-ai/elements/ai';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { ArchivedConversation, ConversationPlaceholder } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { ScanLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConsoleLink, useReaderPosition } from '../navigation.tsx';
import { PageLoadNotice } from '../page-read.tsx';
import type { PageRead } from '../page-read.tsx';
import { useArchivedMessages } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

export function ArchiveScreen({
  data,
  mech,
  pageRead,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly pageRead: PageRead<'archive', ReadRequest<'archive'>>;
}): ReactNode {
  const { request, cursors, setCursors, pending, failure } = pageRead;
  const state = useArchivedMessages(data, request);
  const reader = useReaderPosition(data.scope, `${mech.id}:conversation`);

  return (
    <ResourceView state={state} label="Loading archived messages" placeholder={<ConversationPlaceholder />}>
      {(page, notice) => {
        const older = page.hasMore ? Option.getOrUndefined(page.beforeSequence) : undefined;
        const hasNewer = cursors.length > 0;
        const hasOlder = older !== undefined;
        const hasPages = hasNewer || hasOlder;
        const canGoNewer = hasNewer && pending === undefined;
        const canGoOlder = hasOlder && pending === undefined;

        return (
          <ArchivedConversation
            name={mech.name}
            messages={page.messages}
            initialPosition={reader.position}
            scrollRestorationId={reader.id}
            inspect={(turn) => (
              <MessageAction
                kind="link"
                label="Open run"
                render={
                  <ConsoleLink
                    to={{ workspace: data.workspace.id, mech: mech.id, view: 'conversation', turn }}
                    row={turn}
                  />
                }
              >
                <ScanLine size={16} aria-hidden />
              </MessageAction>
            )}
            controls={
              <>
                {notice}
                <PageLoadNotice failure={failure} />
                {hasPages && (
                  <Row>
                    <Button
                      disabled={!canGoNewer}
                      isPending={pending === 'previous'}
                      pendingLabel="Loading newer messages…"
                      onClick={() => setCursors(cursors.slice(0, -1))}
                    >
                      Newer
                    </Button>
                    <Button
                      disabled={!canGoOlder}
                      isPending={pending === 'next'}
                      pendingLabel="Loading older messages…"
                      onClick={() => {
                        if (older !== undefined) {
                          setCursors([...cursors, older]);
                        }
                      }}
                    >
                      Older
                    </Button>
                  </Row>
                )}
              </>
            }
          />
        );
      }}
    </ResourceView>
  );
}
