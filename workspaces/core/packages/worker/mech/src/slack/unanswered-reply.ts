import { UnansweredReason } from '@mechane/protocol';
import { Option, Record } from 'effect';

type UnansweredReplyInput = { readonly reason: string };

const REPLIES: Readonly<Record<string, string>> = {
  [UnansweredReason.AllowanceExhausted]:
    'I stopped because the remaining daily budget cannot cover another model request. The task is incomplete. After the budget resets or an owner raises the cap, send a message here to continue.',
  [UnansweredReason.ModelFailed]:
    'I stopped because the model request failed after retrying. The task is incomplete. Send a message here to continue.',
  [UnansweredReason.Faulted]:
    'I stopped because this run encountered an execution error. The task is incomplete. Check the run in Mechane, then send a message here to continue.',
  [UnansweredReason.Canceled]: 'This run was canceled. Send a message here if you want me to continue.',
} satisfies Readonly<Record<UnansweredReason, string>>;

/** A terminal notice uses public reason categories, never provider error text that may contain credentials. */
export function unansweredReply({ reason }: UnansweredReplyInput): string {
  const reply = Record.get(REPLIES, reason);

  return Option.getOrElse(reply, () => 'This run stopped without an answer. Check the run in Mechane for details.');
}
