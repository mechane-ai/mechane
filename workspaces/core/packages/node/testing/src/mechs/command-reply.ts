import { EventType } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import { Effect } from 'effect';
import type { ScenarioFailure } from '../types.ts';
import type { TalkingMech } from './types.ts';

/** A command to send a mech as a person's message, which the scripted upstream runs with bash. */
type CommandReplyInput = { readonly mech: TalkingMech; readonly command: string };

/** Runs the command through a turn of the mech, and answers with the turn's reply, or nothing when it had none. */
export const commandReply = Effect.fn('commandReply')(function* ({
  mech,
  command,
}: CommandReplyInput): Effect.fn.Return<string, ScenarioFailure> {
  const { ended } = yield* mech.turn({ text: `${COMMAND_PREFIX}${command}` });

  if (ended.type === EventType.TurnAnswered) {
    return ended.reply;
  }

  return '';
});
