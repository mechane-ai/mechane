import { BYTES_PER_KIBIBYTE } from '@mechane/records';

/** A run can wait for its session, execute, wait for authority, or retain its terminal result. */
export const TurnStatus = {
  Queued: 'queued',
  Running: 'running',
  Waiting: 'waiting',
  Answered: 'answered',
  Unanswered: 'unanswered',
} as const;

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

/** Where a dispatch is: its reservation held and not yet settled, refused by the allowance, or settled once. */
export const DispatchStatus = { Reserved: 'reserved', Refused: 'refused', Settled: 'settled' } as const;

export type DispatchStatus = (typeof DispatchStatus)[keyof typeof DispatchStatus];

/** What a settlement is priced from: the usage the upstream reported, or, without any, the whole reservation. */
export const SettlementBasis = { Usage: 'usage', Reservation: 'reservation' } as const;

export type SettlementBasis = (typeof SettlementBasis)[keyof typeof SettlementBasis];

/** Tool evidence distinguishes an observed result from an exchange whose result was lost. */
export const ToolCallStatus = {
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Unknown: 'unknown',
} as const;

export type ToolCallStatus = (typeof ToolCallStatus)[keyof typeof ToolCallStatus];

/** A shell receipt describes the process outcome independently of SDK tool completion. */
export const BashExecutionStatus = {
  Running: 'running',
  Completed: 'completed',
  TimedOut: 'timed_out',
  Uncertain: 'uncertain',
  Unavailable: 'unavailable',
  PersistenceFailed: 'persistence_failed',
  Refused: 'refused',
} as const;

export type BashExecutionStatus = (typeof BashExecutionStatus)[keyof typeof BashExecutionStatus];

/** Inspection kinds select the safe, tool-specific evidence carried by a trace. */
export const ToolInspectionKind = { Bash: 'bash' } as const;

/** Command previews retain up to this many UTF-8 bytes after execution-time redaction. */
export const TOOL_TRACE_COMMAND_MAX_BYTES = 4 * BYTES_PER_KIBIBYTE;
/** Output previews retain the tail so the latest command diagnostics stay visible. */
export const TOOL_TRACE_OUTPUT_MAX_BYTES = 8 * BYTES_PER_KIBIBYTE;
/** The serialized tool-call array includes JSON escaping and separators in this limit. */
export const TOOL_TRACE_MAX_BYTES = 128 * BYTES_PER_KIBIBYTE;
