import { Bytes, BYTES_PER_KIBIBYTE, HttpStatusCode } from '@mechane/records';
import { guestHealthPath, GuestStatus, StartupPhase } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { guestAnswer } from '../executions/guest-answer.ts';
import { guestReply } from '../executions/guest-reply.ts';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import { GuestAnswer } from '../schemas.ts';
import type { GuestConnection, GuestTransport } from '../types.ts';

const STARTUP_STATUS_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;

/** Shares the guest's HTTP protocol across local machines and the authenticated remote proxy. */
export function httpGuest({ fetch }: GuestTransport): GuestConnection {
  const startup: GuestConnection['startup'] = async ({ machineId }) => {
    const path = guestHealthPath({ machineId });
    const timeout = Duration.toMillis(ANSWER_SLACK);
    const signal = AbortSignal.timeout(timeout);
    const promise = fetch({ path, init: { signal } });
    const sent = await capturePromise({ promise });

    if (Result.isFailure(sent)) {
      return Option.none();
    }

    if (sent.success.status !== HttpStatusCode.Ok) {
      const body = Option.fromNullOr(sent.success.body);

      if (Option.isSome(body)) {
        await body.value.cancel();
      }

      return Option.none();
    }

    const maximumBytes = Bytes.make(STARTUP_STATUS_MAX_BYTES);
    const response = boundGuestResponse({ response: sent.success, maximumBytes });
    const reading = response.text();
    const received = await capturePromise({ promise: reading });

    if (Result.isFailure(received)) {
      return Option.none();
    }

    const codec = Schema.fromJsonString(GuestStatus);
    const decoded = Schema.decodeUnknownResult(codec)(received.success);

    if (Result.isFailure(decoded)) {
      return Option.none();
    }

    return Option.some(decoded.success);
  };

  const health: GuestConnection['health'] = async (input) => {
    const progress = await startup(input);

    return Option.exists(
      progress,
      (value) => value.bootstrap.phase === StartupPhase.GuestReady && Option.isNone(value.bootstrap.failure),
    );
  };

  const execute: GuestConnection['execute'] = async ({ execution, wait, environment }) => {
    const reply = await guestReply({ guest: { fetch }, execution, wait, environment });

    return Option.match(reply, {
      onNone: () => GuestAnswer.cases.Unsettled.make({}),
      onSome: (sent) => guestAnswer({ reply: sent }),
    });
  };

  return { health, startup, execute, fetch };
}
