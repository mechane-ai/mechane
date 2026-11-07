import { useChat } from '@ai-sdk/react';
import { Button, Muted, Row, TextLink } from '@mechane-ai/elements';
import { PromptInput, PromptInputPlaceholder } from '@mechane-ai/elements/ai';
import { Notice } from '@mechane-ai/elements/feedback';
import type { ConsoleData } from '@mechane/console-data';
import { INBOX_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import type { ConversationEntry, ConversationValue } from '../conversations/entry.ts';
import { workingChatStatuses } from '../conversations/entry.ts';
import { useConversationState } from '../conversations/provider.tsx';
import { useWorkspaceDrafts } from '../drafts.tsx';
import { ResourceView } from '../resource.tsx';
import { ConversationActivity } from './conversation-activity.tsx';

type MessageFormProps = {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly entry: ConversationEntry;
  readonly onSession: (sessionId: string) => void;
};

export function MessageForm(props: MessageFormProps): ReactNode {
  const state = useConversationState(props.entry);

  if (state.kind === 'failed') {
    return null;
  }

  return (
    <ResourceView state={state} label="Loading composer" placeholder={<PromptInputPlaceholder isCompact />}>
      {(value) =>
        value.source === 'console' ? (
          <ReadyMessageForm {...props} value={value} />
        ) : (
          <SourceConversation value={value} onSession={props.onSession} />
        )
      }
    </ResourceView>
  );
}

function SourceConversation({
  value,
  onSession,
}: {
  readonly value: ConversationValue;
  readonly onSession: (sessionId: string) => void;
}): ReactNode {
  return (
    <Row shouldSpaceBetween>
      {value.sourceUrl === null ? (
        <Muted>{value.source === 'slack' ? 'Slack conversation' : 'API conversation'} · read only</Muted>
      ) : (
        <TextLink href={value.sourceUrl} target="_blank" rel="noreferrer noopener">
          {value.source === 'slack' ? 'Continue in Slack ↗' : 'Open source ↗'}
        </TextLink>
      )}
      <Button variant="ghost" onClick={() => onSession(value.consoleSessionId)}>
        Console conversation
      </Button>
    </Row>
  );
}

function ReadyMessageForm({
  data,
  mech,
  entry,
  value,
}: MessageFormProps & { readonly value: ConversationValue }): ReactNode {
  const chat = useChat({ chat: value.chat });
  const { message, changeMessage, sendMessage } = useWorkspaceDrafts();
  const { text, submission } = message;
  const [isCanceling, setCanceling] = useState(false);
  const [hasCancelError, setCancelError] = useState(false);
  const isBusy = submission?.isPending === true;
  const isWorking = workingChatStatuses.has(chat.status);
  const isEarlierSubmission = submission !== undefined && submission.id !== message.id;

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (!isWorking) {
      sendMessage(mech, entry.send);
    }
  }

  function cancel(): void {
    setCanceling(true);
    setCancelError(false);
    void entry.cancel().then(
      () => setCanceling(false),
      () => {
        setCanceling(false);
        setCancelError(true);
      },
    );
  }

  return (
    <PromptInput
      isCompact
      name="message"
      label={`Message ${mech.name}`}
      placeholder={`Message ${mech.name}…`}
      value={text}
      onValueChange={changeMessage}
      onSubmit={submit}
      maxLength={INBOX_TEXT_MAX_CHARS}
      isPending={isBusy}
      disabled={mech.status === 'archived'}
      isSubmitDisabled={isWorking || text.trim().length === 0}
      enterBehavior="submit"
      error={submission?.error}
      onStop={isWorking && value.activeRunId !== null ? cancel : undefined}
      isStopPending={isCanceling}
      stopLabel="Stop run"
      controls={
        <>
          <ConversationActivity data={data} mech={mech} runId={value.activeRunId} sessionId={value.sessionId} />
          {hasCancelError && <Notice hasError>The run could not be stopped. Try again.</Notice>}
          {isEarlierSubmission && submission.error !== undefined && (
            <Button variant="ghost" disabled={isWorking} onClick={() => sendMessage(mech, entry.send, true)}>
              Retry previous message
            </Button>
          )}
        </>
      }
    />
  );
}
