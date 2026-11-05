import { Accordion, Button, Muted, Row, Stack, Status, Subheading } from '@mechane-ai/elements';
import { DataTable, DataTableText, ListFooter } from '@mechane-ai/elements/collections';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { DetailPage } from '@mechane-ai/elements/layout';
import type { MemoryList as MemoryPage, ThreadPage } from '@mechane/protocol';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { ConsoleTimestamp } from './record-time.tsx';

export function WorkList({
  page,
  selected,
  onSelect,
  hasPrevious,
  onPrevious,
  onNext,
}: {
  readonly page: ThreadPage;
  readonly selected: string | undefined;
  readonly onSelect: (id: string) => void;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}): ReactNode {
  const detail = page.threads.find((thread) => thread.id === selected);

  return (
    <>
      <DataTable
        caption="Tracked work"
        hideCaption
        rows={page.threads}
        getRowId={(thread) => thread.id}
        activeRowId={selected}
        rowAction={{ onActivate: (thread) => onSelect(thread.id), label: (thread) => `Open ${thread.title}` }}
        columns={[
          { id: 'title', label: 'Work', cell: (thread) => <DataTableText>{thread.title}</DataTableText> },
          {
            id: 'state',
            label: 'State',
            width: 128,
            cell: (thread) => (
              <Status tone={thread.state === 'resolved' ? 'positive' : 'neutral'}>{thread.state}</Status>
            ),
          },
          {
            id: 'updated',
            label: 'Updated',
            secondary: true,
            width: 144,
            cell: (thread) => <ConsoleTimestamp value={thread.updatedAt} />,
          },
        ]}
        empty={
          <EmptyState title="No tracked work yet">
            Tasks the mech tracks appear here. Its messages and executions are in Conversation and Runs.
          </EmptyState>
        }
      />
      {(page.hasMore || hasPrevious) && (
        <ListFooter
          actions={
            <>
              <Button disabled={!hasPrevious} onClick={onPrevious}>
                Previous
              </Button>
              <Button disabled={!page.hasMore} onClick={onNext}>
                Next
              </Button>
            </>
          }
        />
      )}
      {detail !== undefined && (
        <DetailPage>
          <Stack>
            <Subheading>{detail.title}</Subheading>
            <Markdown>{Option.getOrElse(detail.note, () => 'No progress note has been recorded yet.')}</Markdown>
            <Row>
              <Muted>Opened</Muted>
              <ConsoleTimestamp value={detail.openedAt} />
              <Muted>· Updated</Muted>
              <ConsoleTimestamp value={detail.updatedAt} />
            </Row>
          </Stack>
        </DetailPage>
      )}
    </>
  );
}

export function MemoryList({ page }: { readonly page: MemoryPage }): ReactNode {
  if (page.memories.length === 0) {
    return (
      <EmptyState title="No saved notes yet">
        The mech retains its conversation history. Ask it to remember something to save a separate note here.
      </EmptyState>
    );
  }

  return (
    <Accordion.Root>
      {page.memories.map((memory) => (
        <Accordion.Item key={memory.path} value={memory.path}>
          <Accordion.Header>
            <Accordion.Trigger>{memory.path}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>
            <Stack compact>
              <Row>
                <Muted>Version {memory.version} · Saved</Muted>
                <ConsoleTimestamp value={memory.savedAt} />
              </Row>
              <Markdown>{memory.text}</Markdown>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
