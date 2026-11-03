import type { BoundedCallStatus, BoundedDispatchEvidence, BoundedTurnSubmission } from '@mechane/protocol';
import type { BoundedRequestId, DispatchId, Tokens } from '@mechane/records';
import type { DateTime, Option } from 'effect';
import type { SessionIdInput } from '../drone.types.ts';

export type BoundedRequestInput = { readonly requestId: typeof BoundedRequestId.Encoded };
export type BoundedNowInput = { readonly now: DateTime.Utc };
export type RecordBoundedTurnInput = BoundedRequestInput & BoundedTurnSubmission;
export type StopBoundedTurnInput = BoundedRequestInput & BoundedNowInput & { readonly reason: string };

export type FinishBoundedTurnInput = BoundedRequestInput &
  BoundedNowInput & {
    /** Absent when the turn ended with an answer. */
    readonly reason: Option.Option<string>;
    /** Absent when the turn ended without an answer. */
    readonly reply: Option.Option<string>;
  };

export type ClaimBoundedDispatchInput = BoundedNowInput & SessionIdInput & { readonly dispatchId: DispatchId };

/** A granted claim carries the bounds that the provider exchange must enforce. */
export type BoundedDispatchClaim = {
  readonly isAllowed: boolean;
  /** Absent for work outside a bounded submission. */
  readonly requestId: Option.Option<BoundedRequestId>;
  /** Absent when only the deployment's normal output limit applies. */
  readonly maxOutputTokens: Option.Option<Tokens>;
  /** Absent when the turn has no submission deadline. */
  readonly deadlineAt: Option.Option<DateTime.Utc>;
};

export type BeginDispatchEvidenceInput = ClaimBoundedDispatchInput & {
  /** Absent for work whose evidence is outside the bounded request API. */
  readonly requestId: Option.Option<BoundedRequestId>;
  readonly model: BoundedDispatchEvidence['model'];
  readonly contextJson: string;
};

export type RecordDispatchRequestInput = BoundedNowInput & {
  readonly dispatchId: DispatchId;
  readonly requestJson: string;
};

export type EndDispatchEvidenceInput = BoundedNowInput & {
  readonly dispatchId: DispatchId;
  /** Absent when the provider exchange retained no terminal response. */
  readonly responseJson: Option.Option<string>;
  readonly status: Exclude<BoundedCallStatus, typeof BoundedCallStatus.Running>;
};

/** A last admission check prevents sending after cancellation or deadline expiry. */
export type DispatchRequestDecision = { readonly isAllowed: boolean };
