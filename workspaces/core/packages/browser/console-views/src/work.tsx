import { Accordion, Button, Muted, Row, Stack, Status, Subheading, Text, TextButton } from '@mechane-ai/elements';
import { DataTable, DataTableText, ListFooter } from '@mechane-ai/elements/collections';
import { Markdown, MarkdownPreview } from '@mechane-ai/elements/content/markdown';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { DetailPage } from '@mechane-ai/elements/layout';
import type { MemoryList as MemoryPage, Thread, ThreadPage } from '@mechane/protocol';
import { Option } from 'effect';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { ConsoleTimestamp } from './record-time.tsx';

export function WorkList({
  page,
  selected,
  focusRowId,
  onSelect,
  hasPrevious,
  onPrevious,
  onNext,
}: {
  readonly page: ThreadPage;
  readonly selected: string | undefined;
  readonly focusRowId?: string | undefined;
  readonly onSelect: (id: string) => void;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}): ReactNode {
  return (
    <>
      <DataTable
        caption="Tracked work"
        hideCaption
        rows={page.threads}
        getRowId={(thread) => thread.id}
        activeRowId={selected}
        focusRowId={focusRowId}
        rowAction={{ onActivate: (thread) => onSelect(thread.id), label: (thread) => `Open ${thread.title}` }}
        columns={[
          {
            id: 'title',
            label: 'Work',
            role: 'primary',
            cell: (thread) => <DataTableText>{thread.title}</DataTableText>,
          },
          {
            id: 'state',
            label: 'State',
            role: 'status',
            width: 128,
            cell: (thread) => (
              <Status tone={thread.state === 'resolved' ? 'positive' : 'neutral'}>
                {workStateLabel(thread.state)}
              </Status>
            ),
          },
          {
            id: 'updated',
            label: 'Updated',
            role: 'timestamp',
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
    </>
  );
}

export function WorkDetails({
  thread,
  onBack,
  headingRef,
}: {
  readonly thread: Thread;
  readonly onBack: () => void;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <DetailPage>
      <Stack>
        <Row>
          <TextButton onClick={onBack}>
            <ArrowLeft size={14} aria-hidden /> Back to work
          </TextButton>
        </Row>
        <Stack compact>
          <Subheading ref={headingRef} tabIndex={-1}>
            {thread.title}
          </Subheading>
          <Row>
            <Status tone={thread.state === 'resolved' ? 'positive' : 'neutral'}>{workStateLabel(thread.state)}</Status>
            <Muted>Updated</Muted>
            <ConsoleTimestamp value={thread.updatedAt} />
          </Row>
        </Stack>
        <Markdown headingLevel={3}>
          {Option.getOrElse(thread.note, () => 'No progress note has been recorded yet.')}
        </Markdown>
        <Row>
          <Muted>Opened</Muted>
          <ConsoleTimestamp value={thread.openedAt} />
        </Row>
      </Stack>
    </DetailPage>
  );
}

function workStateLabel(state: Thread['state']): string {
  return state.charAt(0).toUpperCase() + state.slice(1).replaceAll('_', ' ');
}

export function MemoryList({
  page,
  runLink,
}: {
  readonly page: MemoryPage;
  readonly runLink: (turnId: string, path: string) => ReactNode;
}): ReactNode {
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
            <Accordion.Trigger>
              <span>
                <MarkdownPreview>{memorySummary(memory.text, memory.path)}</MarkdownPreview>
                <br />
                <Text variant="caption" tone="muted">
                  {memory.path}
                </Text>
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>
            <Stack compact>
              <Row>
                <Muted>Saved</Muted>
                <ConsoleTimestamp value={memory.savedAt} />
                {runLink(memory.turnId, memory.path)}
              </Row>
              <Markdown headingLevel={3}>{memory.text}</Markdown>
              <Muted>Version {memory.version}</Muted>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

function memorySummary(text: string, path: string): string {
  const summary = text.split('\n')[0];

  return summary === undefined || summary.length === 0 ? path : summary;
}
