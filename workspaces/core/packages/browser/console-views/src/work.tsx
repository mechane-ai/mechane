import { Accordion, Button, Muted, Row, Stack, Status, Subheading, Text, TextButton } from '@mechane-ai/elements';
import { DataTable, DataTablePlaceholder, DataTableText, ListFooter } from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout } from '@mechane-ai/elements/collections';
import { Markdown, MarkdownPreview } from '@mechane-ai/elements/content/markdown';
import { EmptyState, SkeletonText } from '@mechane-ai/elements/feedback';
import { DetailPage } from '@mechane-ai/elements/layout';
import type { MemoryList as MemoryPage, Thread, ThreadPage } from '@mechane/protocol';
import { Option } from 'effect';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { ConsoleTimestamp } from './record-time.tsx';

const workColumns = {
  title: { id: 'title', label: 'Work', role: 'primary' },
  state: { id: 'state', label: 'State', role: 'status', width: 128 },
  updated: { id: 'updated', label: 'Updated', role: 'timestamp', isSecondary: true, width: 144 },
} as const satisfies Record<string, DataTableColumnLayout>;

export function WorkListPlaceholder(): ReactNode {
  return <DataTablePlaceholder columns={Object.values(workColumns)} />;
}

export function MemoryListPlaceholder(): ReactNode {
  return (
    <Accordion.Root>
      {[0, 1, 2].map((item) => (
        <Accordion.Item key={item} value={item}>
          <Accordion.Header>
            <Accordion.Trigger disabled>
              <span>
                <SkeletonText width="28ch" />
                <br />
                <Text variant="caption" tone="muted">
                  <SkeletonText width="16ch" />
                </Text>
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

export function WorkList({
  page,
  selected,
  focusRowId,
  onSelect,
  hasPrevious,
  onPrevious,
  onNext,
  loadingPage,
  pageNotice,
}: {
  readonly page: ThreadPage;
  readonly selected: string | undefined;
  readonly focusRowId?: string | undefined;
  readonly onSelect: (id: string) => void;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly loadingPage?: 'previous' | 'next' | undefined;
  readonly pageNotice?: ReactNode;
}): ReactNode {
  const showPagination = page.hasMore || hasPrevious;
  const showFooter = showPagination || pageNotice !== undefined;
  const isPreviousDisabled = !hasPrevious || loadingPage !== undefined;
  const isNextDisabled = !page.hasMore || loadingPage !== undefined;

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
          { ...workColumns.title, cell: (thread) => <DataTableText>{thread.title}</DataTableText> },
          {
            ...workColumns.state,
            cell: (thread) => (
              <Status tone={thread.state === 'resolved' ? 'positive' : 'neutral'}>
                {workStateLabel(thread.state)}
              </Status>
            ),
          },
          { ...workColumns.updated, cell: (thread) => <ConsoleTimestamp value={thread.updatedAt} /> },
        ]}
        empty={
          <EmptyState title="No tracked work yet">
            Tasks the mech tracks appear here. Its messages and executions are in Conversation and Runs.
          </EmptyState>
        }
      />
      {showFooter && (
        <ListFooter
          actions={
            showPagination ? (
              <>
                <Button
                  isPending={loadingPage === 'previous'}
                  pendingLabel="Loading previous work…"
                  disabled={isPreviousDisabled}
                  onClick={onPrevious}
                >
                  Previous
                </Button>
                <Button
                  isPending={loadingPage === 'next'}
                  pendingLabel="Loading next work…"
                  disabled={isNextDisabled}
                  onClick={onNext}
                >
                  Next
                </Button>
              </>
            ) : undefined
          }
        >
          {pageNotice}
        </ListFooter>
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
        <Stack isCompact>
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
            <Stack isCompact>
              <Row>
                <Muted>Saved</Muted>
                <ConsoleTimestamp value={memory.savedAt} />
                {Option.isSome(memory.turnId) && runLink(memory.turnId.value, memory.path)}
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
