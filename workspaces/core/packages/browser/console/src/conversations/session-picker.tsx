import { Button, Text } from '@mechane-ai/elements';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import { Menu } from '@mechane-ai/elements/overlays';
import type { ConsoleData } from '@mechane/console-data';
import type { ConversationSession, SessionPage } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Check, ChevronDown, Code, Hash, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ResourceView } from '../resource.tsx';
import type { ResourceState } from '../resource.tsx';

type SessionPickerProps = {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly sessionId: string;
  readonly source: ConversationSession['source'];
  readonly title: string;
  readonly consoleSessionId: string;
  readonly onSelect: (sessionId: string) => void;
};

const styles = stylex.create({
  title: { minWidth: 0, maxWidth: '36ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
});

function SessionIcon({ source }: { readonly source: ConversationSession['source'] }): ReactNode {
  if (source === 'api') {
    return <Code size={16} aria-hidden />;
  }

  return source === 'slack' ? <Hash size={16} aria-hidden /> : <MessageSquare size={16} aria-hidden />;
}

const sourceLabels = { slack: 'Slack', api: 'API', console: 'Console' } as const;

export function SessionPicker({
  data,
  mechId,
  sessionId,
  source,
  title,
  consoleSessionId,
  onSelect,
}: SessionPickerProps): ReactNode {
  const [isOpen, setOpen] = useState(false);
  const [page, setPage] = useState<SessionPage>();
  const [isPending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [cursor, setCursor] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const lifetime = new AbortController();

    void data.conversations.sessions(mechId, lifetime.signal, cursor).then(
      (received) => {
        if (!lifetime.signal.aborted) {
          setPage((previous) => {
            if (cursor === undefined || previous === undefined) {
              return received;
            }

            const priorIds = new Set(previous.sessions.map((session) => session.id));

            return {
              ...received,
              sessions: [...previous.sessions, ...received.sessions.filter((session) => !priorIds.has(session.id))],
            };
          });
          setFailure(undefined);
          setPending(false);
        }
      },
      (problem: unknown) => {
        if (!lifetime.signal.aborted) {
          setFailure(problem);
          setPending(false);
        }
      },
    );

    return () => lifetime.abort();
  }, [data, mechId, isOpen, cursor, attempt]);

  function retry(): void {
    setPending(true);
    setAttempt((value) => value + 1);
  }

  const failed = { kind: 'failed', problem: failure, retry, isRetrying: isPending } as const;

  const state: ResourceState<SessionPage> =
    page === undefined
      ? failure === undefined
        ? { kind: 'pending' }
        : failed
      : {
          kind: 'ready',
          value: page,
          refresh: failure === undefined ? { kind: isPending ? 'pending' : 'idle' } : failed,
        };

  return (
    <Menu.Root
      open={isOpen}
      onOpenChange={(open) => {
        setOpen(open);

        if (open) {
          setCursor(undefined);
          setPending(true);
          setFailure(undefined);
        }
      }}
    >
      <Menu.Trigger render={<Button variant="ghost" aria-label="Choose conversation" title={title} />}>
        <SessionIcon source={source} />
        {sourceLabels[source]} conversation
        <ChevronDown size={14} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start">
          <Menu.Popup>
            <Menu.Group aria-busy={isPending}>
              <Menu.GroupLabel>Conversations</Menu.GroupLabel>
              <ResourceView
                state={state}
                label="Loading conversations"
                placeholder={
                  <Menu.Item disabled>
                    <SkeletonText width="24ch" />
                  </Menu.Item>
                }
                failure={
                  <Menu.Item closeOnClick={false} disabled={isPending} onClick={retry}>
                    Could not load. Try again
                  </Menu.Item>
                }
              >
                {(received, notice) => (
                  <>
                    {received.sessions.map((session) => (
                      <Menu.Item key={session.id} onClick={() => onSelect(session.id)}>
                        <SessionIcon source={session.source} />
                        <span title={session.title} {...stylex.props(styles.title)}>
                          {session.title}
                        </span>
                        <Text variant="caption" tone="muted">
                          {sourceLabels[session.source]}
                        </Text>
                        {session.id === sessionId && <Check size={14} aria-hidden />}
                      </Menu.Item>
                    ))}
                    {notice}
                  </>
                )}
              </ResourceView>
              {page?.hasMore === true && (
                <Menu.Item
                  closeOnClick={false}
                  disabled={isPending}
                  onClick={() => {
                    setPending(true);
                    setFailure(undefined);
                    setCursor(page.sessions.at(-1)?.id);
                  }}
                >
                  More conversations
                </Menu.Item>
              )}
              <Menu.Separator />
              <Menu.Item onClick={() => onSelect(consoleSessionId)}>Console conversation</Menu.Item>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
