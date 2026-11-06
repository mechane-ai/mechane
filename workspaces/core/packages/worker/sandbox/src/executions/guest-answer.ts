import { HttpStatusCode } from '@mechane/records';
import { ExecutionObservation, ReceiptStatus } from '@mechane/sandbox-wire';
import type { ExecutionReceipt } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { GuestAnswer } from '../schemas.ts';
import type { GuestReply } from './types.ts';

/**
 * What a guest answered for an execution: its receipt, or a bare 404 because the machine it serves is another one. A
 * malformed request's 400 decodes as neither, so it fails the call with what the guest said.
 */
const GuestAnswerBody = Schema.Union([
  Schema.Struct({ status: Schema.Literal(HttpStatusCode.Ok), body: Schema.fromJsonString(ExecutionObservation) }),
  Schema.Struct({ status: Schema.Literal(HttpStatusCode.NotFound) }),
]);

type GuestAnswerBody = typeof GuestAnswerBody.Type;

type GuestAnswerInput = { readonly reply: GuestReply };

/** The receipt a guest answered for an execution. */
type ReceiptAnswerInput = { readonly receipt: ExecutionReceipt };

/** What a guest's reply answers: the machine is another one, or the guest sent the execution's receipt. */
export function guestAnswer({ reply }: GuestAnswerInput): GuestAnswer {
  const answered: GuestAnswerBody = Schema.decodeUnknownSync(GuestAnswerBody)(reply);

  switch (answered.status) {
    case HttpStatusCode.NotFound:
      return GuestAnswer.cases.Lost.make({});
    case HttpStatusCode.Ok:
      return Option.match(answered.body, {
        onNone: () => GuestAnswer.cases.NotStarted.make({}),
        onSome: (receipt) => receiptAnswer({ receipt }),
      });
  }
}

/** What a guest's receipt answers: one that still runs leaves the execution unsettled, and any other settles it. */
function receiptAnswer({ receipt }: ReceiptAnswerInput): GuestAnswer {
  if (receipt.state === ReceiptStatus.Running) {
    return GuestAnswer.cases.Unsettled.make({});
  }

  return GuestAnswer.cases.Settled.make({ receipt });
}
