import { HttpStatusCode } from '@mechane/records';
import { guestHealthPath } from '@mechane/sandbox-wire';
import { Duration, Option } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { guestAnswer } from '../executions/guest-answer.ts';
import { guestReply } from '../executions/guest-reply.ts';
import { GuestAnswer } from '../schemas.ts';
import type { GuestConnection, GuestTransport } from '../types.ts';

/** Shares the guest's HTTP protocol across local machines and the authenticated remote proxy. */
export function httpGuest({ fetch }: GuestTransport): GuestConnection {
  const health: GuestConnection['health'] = async ({ machineId }) => {
    const path = guestHealthPath({ machineId });
    const timeout = Duration.toMillis(ANSWER_SLACK);
    const signal = AbortSignal.timeout(timeout);
    const response = await fetch({ path, init: { signal } }).then(Option.some, () => Option.none());

    return Option.isSome(response) && response.value.status === HttpStatusCode.NoContent;
  };

  const execute: GuestConnection['execute'] = async ({ execution, wait }) => {
    const reply = await guestReply({ guest: { fetch }, execution, wait });

    return Option.match(reply, {
      onNone: () => GuestAnswer.cases.Unsettled.make({}),
      onSome: (sent) => guestAnswer({ reply: sent }),
    });
  };

  return { health, execute, fetch };
}
