import { writeDiagnostic } from '@mechane/program';
import { TurnStatus } from '@mechane/protocol';
import type { Trace } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { Option, Record, Result, Schema } from 'effect';
import { readTrace } from '../mechs.ts';
import type { MechContext } from '../types.ts';

const TRACE_DEADLINE_MS = 2000;
const FAILURE_DEPTH = 3;
const PROCESS_EXIT_CODE_MAX = 255;
const TURN_STATUSES: ReadonlySet<string> = new Set(Record.values(TurnStatus));

const TRANSPORT_CODES: ReadonlySet<string> = new Set([
  'ABORT_ERR',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const PROCESS_SIGNALS: ReadonlySet<string> = new Set(['SIGABRT', 'SIGINT', 'SIGKILL', 'SIGTERM']);

const FailureFields = Schema.Struct({
  code: Schema.optionalKey(Schema.Unknown),
  exitCode: Schema.optionalKey(Schema.Unknown),
  signal: Schema.optionalKey(Schema.Unknown),
  cause: Schema.optionalKey(Schema.Unknown),
});

export const CancellationPhase = {
  Preparing: 'preparing',
  AwaitingCommand: 'awaiting_command',
  ReadingReceipt: 'reading_receipt',
  HoldingCancellation: 'holding_cancellation',
  Stopping: 'stopping',
  Replaying: 'replaying',
  Reconciling: 'reconciling',
  Verifying: 'verifying',
} as const;

export type CancellationPhase = (typeof CancellationPhase)[keyof typeof CancellationPhase];

export type CancellationObservation = {
  readonly phase: CancellationPhase;
  readonly notificationId: string | null;
  readonly turnId: string | null;
  readonly executionId: string | null;
};

type CancellationDiagnosticInput = MechContext & {
  readonly observed: CancellationObservation;
  readonly toolCallId: string;
  readonly modelRequestCount: number;
  readonly commandGateRequestCount: number;
  readonly cancellationRequestCount: number | null;
  readonly cause: unknown;
};

function safeId(value: string | null | undefined): string | null {
  if (Schema.is(RecordId)(value)) {
    return value;
  }

  return null;
}

function safeTurnStatus(status: string | undefined): string | null {
  if (status !== undefined && TURN_STATUSES.has(status)) {
    return status;
  }

  return null;
}

function failureCodes(cause: unknown) {
  const codes = new Set<string>();
  const outcome: { exitCode: number | null; signal: string | null } = { exitCode: null, signal: null };
  let current = cause;

  for (let depth = 0; depth < FAILURE_DEPTH; depth += 1) {
    const decoded = Schema.decodeUnknownResult(FailureFields)(current);

    if (Result.isFailure(decoded)) {
      break;
    }

    const fields = decoded.success;

    if (typeof fields.code === 'string' && TRANSPORT_CODES.has(fields.code)) {
      codes.add(fields.code);
    }

    if (typeof fields.exitCode === 'number' && Number.isSafeInteger(fields.exitCode)) {
      if (fields.exitCode >= 0 && fields.exitCode <= PROCESS_EXIT_CODE_MAX) {
        outcome.exitCode = fields.exitCode;
      }
    }

    if (typeof fields.signal === 'string' && PROCESS_SIGNALS.has(fields.signal)) {
      outcome.signal = fields.signal;
    }

    current = fields.cause;
  }

  return { transportCodes: [...codes], processExitCode: outcome.exitCode, processSignal: outcome.signal };
}

export async function writeCancellationDiagnostic(input: CancellationDiagnosticInput): Promise<void> {
  const observation: { trace?: Trace; failure?: unknown } = {};

  if (input.observed.turnId !== null) {
    try {
      observation.trace = await readTrace({
        ...input,
        turnId: input.observed.turnId,
        signal: AbortSignal.timeout(TRACE_DEADLINE_MS),
      });
    } catch (cause) {
      observation.failure = cause;
    }
  }

  const trace = observation.trace;
  const call = trace?.toolCalls?.find((candidate) => candidate.id === input.toolCallId);
  const result = Option.getOrNull(call?.inspection?.result ?? Option.none());
  const turnStatus = trace?.turn.status;

  const summary = {
    phase: input.observed.phase,
    workspaceId: safeId(input.account.workspaceId),
    mechId: safeId(input.mechId),
    notificationId: safeId(input.observed.notificationId),
    turnId: safeId(input.observed.turnId),
    toolCallId: safeId(input.toolCallId),
    executionId: safeId(call?.inspection?.executionId ?? input.observed.executionId),
    modelRequestCount: input.modelRequestCount,
    commandGateRequestCount: input.commandGateRequestCount,
    cancellationRequestCount: input.cancellationRequestCount,
    traceAvailable: trace !== undefined,
    turnStatus: safeTurnStatus(turnStatus),
    toolStatus: call?.status ?? null,
    executionStatus: result?.status ?? null,
    processExitCode: Option.getOrNull(result?.exitCode ?? Option.none()),
    guestStarted: null,
    environmentTransportCode: null,
    failure: failureCodes(input.cause),
    traceReadFailure: failureCodes(observation.failure),
  };

  writeDiagnostic({ program: 'smoke', line: `cancellation.failure ${JSON.stringify(summary)}` });
}
