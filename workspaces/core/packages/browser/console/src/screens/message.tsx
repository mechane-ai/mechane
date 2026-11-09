import { Button } from '@mechane-ai/elements';
import { PromptInput } from '@mechane-ai/elements/ai';
import type { ConsoleData } from '@mechane/console-data';
import { NOTIFICATION_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import type { ReactNode, SubmitEvent } from 'react';
import type { ConversationEntry } from '../conversations/entry.ts';
import { useWorkspaceDrafts } from '../drafts.tsx';
import { ConversationActivity } from './conversation-activity.tsx';

type MessageFormProps = { readonly data: ConsoleData; readonly mech: Mech; readonly entry: ConversationEntry };

export function MessageForm({ data, mech, entry }: MessageFormProps): ReactNode {
  const { message, changeMessage, sendMessage } = useWorkspaceDrafts();
  const { text, submission } = message;
  const isBusy = submission?.isPending === true;
  const isEarlierSubmission = submission !== undefined && submission.id !== message.id;

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    sendMessage(mech, entry.send);
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
      maxLength={NOTIFICATION_TEXT_MAX_CHARS}
      isPending={isBusy}
      disabled={mech.status === 'archived'}
      isSubmitDisabled={text.trim().length === 0}
      enterBehavior="submit"
      error={submission?.error}
      controls={
        <>
          <ConversationActivity data={data} mech={mech} />
          {isEarlierSubmission && submission.error !== undefined && (
            <Button variant="ghost" disabled={isBusy} onClick={() => sendMessage(mech, entry.send, true)}>
              Retry previous message
            </Button>
          )}
        </>
      }
    />
  );
}
