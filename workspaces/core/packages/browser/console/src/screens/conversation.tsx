import { useChat } from '@ai-sdk/react';
import { AgentAvatar, Button, Row, TextLink } from '@mechane-ai/elements';
import { MessageAction } from '@mechane-ai/elements/ai';
import { Notice } from '@mechane-ai/elements/feedback';
import type { ConsoleData } from '@mechane/console-data';
import { ConversationPlaceholder, MechConversation } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { ScanLine } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ConversationEntry, ConversationValue } from '../conversations/entry.ts';
import { workingChatStatuses } from '../conversations/entry.ts';
import { useConversationState } from '../conversations/provider.tsx';
import { SessionPicker } from '../conversations/session-picker.tsx';
import { useMechAppearance } from '../mech-appearance.tsx';
import { ConsoleLink, useReaderPosition } from '../navigation.tsx';
import { ResourceView } from '../resource.tsx';

type ConversationScreenProps = {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly entry: ConversationEntry;
  readonly isActive: boolean;
  readonly onSession: (sessionId: string | undefined) => void;
};

export function ConversationScreen(props: ConversationScreenProps): ReactNode {
  const state = useConversationState(props.entry);

  return (
    <ResourceView state={state} placeholder={<ConversationPlaceholder />} label="Loading conversation">
      {(value, notice) => <ConversationPage key={value.sessionId} {...props} value={value} notice={notice} />}
    </ResourceView>
  );
}

function ConversationPage({
  data,
  mech,
  entry,
  value,
  notice,
  onSession,
}: ConversationScreenProps & { readonly value: ConversationValue; readonly notice: ReactNode }): ReactNode {
  const chat = useChat({ chat: value.chat, throttle: 50 });
  const { appearance } = useMechAppearance(mech.id);
  const viewport = useRef<HTMLDivElement>(null);
  const reader = useReaderPosition(data.scope, `${mech.id}:conversation:${value.sessionId}`);
  const isStreaming = workingChatStatuses.has(chat.status);
  const latest = chat.messages.at(-1);
  const hasCurrentActivity = latest?.role === 'assistant' && latest.parts.some((part) => part.type !== 'step-start');

  useEffect(() => {
    if (chat.status === 'streaming' && hasCurrentActivity) {
      void data.refreshActivity(mech.id);
    }
  }, [chat.status, hasCurrentActivity, data, mech.id]);

  return (
    <MechConversation
      name={mech.name}
      avatar={<AgentAvatar seed={mech.id} appearance={appearance} />}
      messages={chat.messages}
      isStreaming={isStreaming}
      viewportRef={viewport}
      scrollRestorationId={reader.id}
      initialPosition={reader.position}
      inspect={(turn) => (
        <MessageAction
          label="Open run"
          kind="link"
          render={
            <ConsoleLink
              to={{ workspace: data.workspace.id, mech: mech.id, session: value.sessionId, turn }}
              row={turn}
            />
          }
        >
          <ScanLine size={16} aria-hidden />
        </MessageAction>
      )}
      controls={
        <>
          <Row shouldSpaceBetween>
            <SessionPicker
              data={data}
              mechId={mech.id}
              sessionId={value.sessionId}
              source={value.source}
              title={value.title}
              consoleSessionId={value.consoleSessionId}
              onSelect={onSession}
            />
            {value.source === 'slack' && value.sourceUrl !== null && (
              <TextLink href={value.sourceUrl} target="_blank" rel="noreferrer noopener">
                Open in Slack ↗
              </TextLink>
            )}
          </Row>
          {notice}
          {chat.error !== undefined && value.activeWorkflowId !== null && (
            <Notice hasError>
              The live connection was interrupted.{' '}
              <Button
                variant="ghost"
                onClick={() => {
                  void entry.resume();
                }}
                disabled={isStreaming}
              >
                Reconnect
              </Button>
            </Notice>
          )}
          {value.hasMore && (
            <Button
              variant="ghost"
              isPending={value.isLoadingEarlier}
              pendingLabel="Loading earlier messages…"
              onClick={() => {
                void entry.earlier();
              }}
            >
              Earlier messages
            </Button>
          )}
        </>
      }
    />
  );
}
