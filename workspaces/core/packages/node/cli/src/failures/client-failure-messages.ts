import { AnswerStep } from '@mechane/client';
import type { ClientFailure, OriginUnreachable, RequestTimedOut, ResponseUnreadable } from '@mechane/client';
import { ExitStatus } from '@mechane/commands';
import { Duration, Option } from 'effect';
import { answeredMessage } from './answered-message.ts';
import { ownMessage } from './own-message.ts';
import type { FailureMessage, FailureMessages } from './types.ts';

type UnreadableMessageInput = Pick<ResponseUnreadable, '_tag' | 'status' | 'step' | 'reason'>;

/**
 * The lowest HTTP status of a server error. An answer with such a status that is not Mechane's comes from a runtime or
 * proxy in front of the deployment, such as one draining for a restart. The deployment is then unavailable.
 */
const SERVER_ERROR_STATUS = 500;

/** The report of each way a call fails, under its tag: the deployment's error, or no answer of Mechane's. */
export const CLIENT_FAILURE_MESSAGES: Readonly<FailureMessages<ClientFailure>> = {
  OperationFailed: ({ family, message, failure }) =>
    answeredMessage({ failed: { family, message, failure }, note: Option.none() }),
  OriginUnreachable: ({ _tag, reason }: OriginUnreachable) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Unavailable,
      message: `no server answered: ${reason}`,
      next: Option.some('start one with mise run dev or check the origin'),
    }),
  RequestTimedOut: ({ _tag, timeout }: RequestTimedOut) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Unavailable,
      message: `no answer within ${Duration.format(timeout)}`,
      next: Option.some('check that the deployment serves requests'),
    }),
  ResponseUnreadable: ({ _tag, status, step, reason }) => unreadableMessage({ _tag, status, step, reason }),
};

/** An answer that is not Mechane's: a server error means the deployment is unavailable, any other a foreign origin. */
function unreadableMessage({ _tag, status, step, reason }: UnreadableMessageInput): FailureMessage {
  const code = _tag;

  const detail: string = (() => {
    switch (step) {
      case AnswerStep.ParseJson:
        return 'the body is not JSON';
      case AnswerStep.Decode:
        return reason;
    }
  })();

  const message = `the answer with status ${status} is not Mechane's: ${detail}`;

  if (status >= SERVER_ERROR_STATUS) {
    const next = Option.some('the deployment is unavailable, so try again');

    return ownMessage({ code, status: ExitStatus.Unavailable, message, next });
  }

  return ownMessage({ code, status: ExitStatus.Failed, message, next: Option.some('check the origin') });
}
