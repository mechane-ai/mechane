import { Accordion, Button, Muted, Row, Stack, Status, Subheading } from '@mechane-ai/elements';
import { DataTable, ListFooter } from '@mechane-ai/elements/collections';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState } from '@mechane-ai/elements/feedback';
import type { ConsoleData } from '@mechane/console-data';
import { timeLabel } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePageCursors } from '../navigation.tsx';
import { Resource } from '../resource.tsx';

export function WorkScreen({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const [cursors, setCursors] = usePageCursors('work', []);
  const after = cursors.at(-1);
  const source = useMemo(() => data.threads(mech.id, Option.fromNullishOr(after)), [data, mech.id, after]);
  const [selected, setSelected] = useState<string>();

  return (
    <Stack>
      <Stack compact>
        <Subheading>Work</Subheading>
        <Muted>The work threads this mech tracks inside its ongoing conversation.</Muted>
      </Stack>
      <Resource data={data} source={source}>
        {(page, notice) => {
          const detail = page.threads.find((thread) => thread.id === selected);

          return (
            <Stack>
              {notice}
              <DataTable
                caption="Tracked work"
                hideCaption
                rows={page.threads}
                getRowId={(thread) => thread.id}
                activeRowId={selected}
                rowAction={{
                  onActivate: (thread) => setSelected(thread.id),
                  label: (thread) => `Open ${thread.title}`,
                }}
                columns={[
                  { id: 'title', label: 'Work', cell: (thread) => thread.title, truncate: true },
                  {
                    id: 'state',
                    label: 'State',
                    cell: (thread) => (
                      <Status tone={thread.state === 'resolved' ? 'positive' : 'neutral'}>{thread.state}</Status>
                    ),
                  },
                  { id: 'updated', label: 'Updated', secondary: true, cell: (thread) => timeLabel(thread.updatedAt) },
                ]}
                empty={
                  <EmptyState title="No tracked work yet">
                    The mech can open work threads as it takes on tasks. Messages and completed runs still appear in
                    Conversation and Runs.
                  </EmptyState>
                }
              />
              {detail !== undefined && (
                <Stack>
                  <Subheading>{detail.title}</Subheading>
                  <Markdown>{Option.getOrElse(detail.note, () => 'No progress note has been recorded yet.')}</Markdown>
                  <Muted>
                    Opened {timeLabel(detail.openedAt)} · Updated {timeLabel(detail.updatedAt)}
                  </Muted>
                </Stack>
              )}
              {(page.hasMore || cursors.length > 0) && (
                <ListFooter
                  actions={
                    <Row>
                      <Button disabled={cursors.length === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
                        Previous
                      </Button>
                      <Button
                        disabled={!page.hasMore}
                        onClick={() => {
                          const last = page.threads.at(-1);

                          if (last !== undefined) {
                            setCursors([...cursors, last.id]);
                          }
                        }}
                      >
                        Next
                      </Button>
                    </Row>
                  }
                >
                  Work threads, oldest first
                </ListFooter>
              )}
            </Stack>
          );
        }}
      </Resource>
    </Stack>
  );
}

export function MemoryScreen({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const source = useMemo(() => data.memories(mech.id), [data, mech.id]);

  return (
    <Stack>
      <Stack compact>
        <Subheading>Memory</Subheading>
        <Muted>
          The conversation is retained across runs. These are the separate notes the mech has explicitly saved for
          later.
        </Muted>
      </Stack>
      <Resource data={data} source={source}>
        {(page, notice) => (
          <>
            {notice}
            {page.memories.length === 0 ? (
              <EmptyState title="No saved notes yet">
                This mech still has its conversation history. Ask it to remember something when a durable note would
                help.
              </EmptyState>
            ) : (
              <Accordion.Root>
                {page.memories.map((memory) => (
                  <Accordion.Item key={memory.path} value={memory.path}>
                    <Accordion.Header>
                      <Accordion.Trigger>{memory.path}</Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Panel>
                      <Stack compact>
                        <Muted>
                          Version {memory.version} · Saved {timeLabel(memory.savedAt)}
                        </Muted>
                        <Markdown>{memory.text}</Markdown>
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion.Root>
            )}
          </>
        )}
      </Resource>
    </Stack>
  );
}
