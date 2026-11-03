import type { catalog } from '@mechane/protocol';
import type { BoundedRequestId, PrincipalId } from '@mechane/records';

export type BoundedTurnInput = { readonly requestId: typeof BoundedRequestId.Encoded };

export type SubmitBoundedTurnInput = BoundedTurnInput & {
  readonly submission: typeof catalog.submitBoundedTurn.body.Encoded;
  readonly senderId: typeof PrincipalId.Encoded;
};

export type CancelBoundedTurnInput = BoundedTurnInput & { readonly cancelerId: typeof PrincipalId.Encoded };
