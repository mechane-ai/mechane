import { Button, Text } from '@mechane-ai/elements';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import { Menu } from '@mechane-ai/elements/overlays';
import { readRequests } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import type { ConversationSession } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Check, ChevronDown, Code, Hash, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useSessions } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

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

  return (
    <Menu.Root open={isOpen} onOpenChange={setOpen}>
      <Menu.Trigger render={<Button variant="ghost" aria-label="Choose conversation" title={title} />}>
        <SessionIcon source={source} />
        {sourceLabels[source]} conversation
        <ChevronDown size={14} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start">
          <Menu.Popup>
            <Menu.Group>
              <Menu.GroupLabel>Conversations</Menu.GroupLabel>
              {isOpen && (
                <SessionChoices
                  key={`${data.scope}:${mechId}`}
                  data={data}
                  mechId={mechId}
                  sessionId={sessionId}
                  onSelect={onSelect}
                  after={null}
                  seen={[]}
                />
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

type SessionChoicesProps = Pick<SessionPickerProps, 'data' | 'mechId' | 'sessionId' | 'onSelect'> & {
  readonly after: string | null;
  readonly seen: ReadonlyArray<string>;
};

function SessionChoices({ data, mechId, sessionId, onSelect, after, seen }: SessionChoicesProps): ReactNode {
  const state = useSessions(data, readRequests.sessions(mechId, after));
  const [next, setNext] = useState<string>();

  return (
    <ResourceView
      state={state}
      label="Loading conversations"
      placeholder={
        <Menu.Item disabled>
          <SkeletonText width="24ch" />
        </Menu.Item>
      }
      failure={
        state.kind === 'failed' && (
          <Menu.Item closeOnClick={false} disabled={state.isRetrying} onClick={state.retry}>
            Could not load. Try again
          </Menu.Item>
        )
      }
    >
      {(page, notice) => (
        <>
          {page.sessions
            .filter((session) => !seen.includes(session.id))
            .map((session) => (
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
          {next === undefined ? (
            page.hasMore && (
              <Menu.Item closeOnClick={false} onClick={() => setNext(page.sessions.at(-1)?.id)}>
                More conversations
              </Menu.Item>
            )
          ) : (
            <SessionChoices
              data={data}
              mechId={mechId}
              sessionId={sessionId}
              onSelect={onSelect}
              after={next}
              seen={[...seen, ...page.sessions.map((session) => session.id)]}
            />
          )}
        </>
      )}
    </ResourceView>
  );
}
