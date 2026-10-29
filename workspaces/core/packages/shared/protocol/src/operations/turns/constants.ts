/** Where a turn is: working on its inbox items, or ended with a reply or without one. */
export const TurnStatus = { Running: 'running', Answered: 'answered', Unanswered: 'unanswered' } as const;

export type TurnStatus = (typeof TurnStatus)[keyof typeof TurnStatus];

/**
 * Why a turn ended without a reply. The workspace's allowance or the mech's cap could not cover a dispatch, the model
 * failed after its retries, the turn's own work faulted, or a member canceled it.
 */
export const UnansweredReason = {
  AllowanceExhausted: 'allowance_exhausted',
  ModelFailed: 'model_failed',
  Faulted: 'faulted',
  Canceled: 'canceled',
} as const;

export type UnansweredReason = (typeof UnansweredReason)[keyof typeof UnansweredReason];

/** Why a turn that owes a turn note ended without a reply: a cancel, or a fault of its work. */
export const NOTED_REASONS = [UnansweredReason.Canceled, UnansweredReason.Faulted] as const;

/** Where a dispatch is: its reservation held and not yet settled, refused by the allowance, or settled once. */
export const DispatchStatus = { Reserved: 'reserved', Refused: 'refused', Settled: 'settled' } as const;

export type DispatchStatus = (typeof DispatchStatus)[keyof typeof DispatchStatus];

/** What a settlement is priced from: the usage the upstream reported, or, without any, the whole reservation. */
export const SettlementBasis = { Usage: 'usage', Reservation: 'reservation' } as const;

export type SettlementBasis = (typeof SettlementBasis)[keyof typeof SettlementBasis];
