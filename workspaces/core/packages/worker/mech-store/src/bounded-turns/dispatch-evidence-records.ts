import { BoundedCallStatus, BoundedTurnLimitReason, TurnStatus } from '@mechane/protocol';
import { RecordText, renamedWireStruct } from '@mechane/records';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import { BoundedTurnRow, DispatchEvidenceRow } from './schemas.ts';
import type {
  BeginDispatchEvidenceInput,
  BoundedDispatchClaim,
  BoundedNowInput,
  BoundedRequestInput,
  ClaimBoundedDispatchInput,
  DispatchRequestDecision,
  EndDispatchEvidenceInput,
  RecordDispatchRequestInput,
} from './types.ts';

const RequestState = renamedWireStruct({
  fields: {
    reason: Schema.OptionFromNullOr(RecordText),
    deadlineAt: Schema.DateTimeUtcFromMillis,
    endedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  },
  renames: { deadlineAt: 'deadline_at_ms', endedAt: 'ended_at_ms' },
});

type RefusalReasonInput = { readonly request: BoundedTurnRow; readonly now: DateTime.Utc };

/** Claims dispatch allowance and retains provider evidence in the mech's transaction. */
export function dispatchEvidenceRecords({ sql }: RecordsInput) {
  return {
    claimBoundedDispatch: (input: ClaimBoundedDispatchInput): BoundedDispatchClaim =>
      claimBoundedDispatch({ sql, ...input }),
    beginDispatchEvidence: (input: BeginDispatchEvidenceInput): void => beginDispatchEvidence({ sql, ...input }),
    recordDispatchRequest: (input: RecordDispatchRequestInput): DispatchRequestDecision =>
      recordDispatchRequest({ sql, ...input }),
    endDispatchEvidence: (input: EndDispatchEvidenceInput): void => endDispatchEvidence({ sql, ...input }),
    dispatchEvidence: (input: BoundedRequestInput): ReadonlyArray<DispatchEvidenceRow> =>
      dispatchEvidence({ sql, ...input }),
    interruptDispatchEvidence: (input: BoundedNowInput): void => interruptDispatchEvidence({ sql, ...input }),
  };
}

function activeBoundedTurn({ sql }: RecordsInput): Option.Option<BoundedTurnRow> {
  const cursor = sql.exec(
    'SELECT bounded_turns.*, inbox_items.turn_id, inbox_items.text, inbox_items.sender_id, inbox_items.received_at_ms FROM bounded_turns JOIN inbox_items ON inbox_items.id = bounded_turns.request_id JOIN turns ON turns.id = inbox_items.turn_id WHERE turns.status = ?',
    TurnStatus.Running,
  );

  return decodeFirst({ cursor, schema: BoundedTurnRow });
}

function claimBoundedDispatch({ sql, now }: SqlCall<ClaimBoundedDispatchInput>): BoundedDispatchClaim {
  const bounded = activeBoundedTurn({ sql });

  if (Option.isNone(bounded)) {
    return { isAllowed: true, requestId: Option.none(), maxOutputTokens: Option.none(), deadlineAt: Option.none() };
  }

  const request = bounded.value;

  const limits = {
    requestId: Option.some(request.requestId),
    maxOutputTokens: Option.some(request.maxOutputTokens),
    deadlineAt: Option.some(request.deadlineAt),
  };

  const reason = refusalReason({ request, now });

  if (Option.isSome(reason)) {
    sql.exec(
      'UPDATE bounded_turns SET reason = COALESCE(reason, ?) WHERE request_id = ?',
      reason.value,
      request.requestId,
    );

    return { isAllowed: false, ...limits };
  }

  sql.exec('UPDATE bounded_turns SET dispatched_count = dispatched_count + 1 WHERE request_id = ?', request.requestId);

  return { isAllowed: true, ...limits };
}

function refusalReason({ request, now }: RefusalReasonInput): Option.Option<string> {
  if (Option.isSome(request.reason)) {
    return request.reason;
  }

  if (DateTime.isLessThanOrEqualTo(request.deadlineAt, now)) {
    return Option.some(BoundedTurnLimitReason.DeadlineExceeded);
  }

  if (request.dispatchedCount >= request.maxModelDispatches) {
    return Option.some(BoundedTurnLimitReason.DispatchLimit);
  }

  return Option.none();
}

function beginDispatchEvidence({
  sql,
  dispatchId,
  requestId,
  model,
  contextJson,
  now,
}: SqlCall<BeginDispatchEvidenceInput>): void {
  if (Option.isNone(requestId)) {
    return;
  }

  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'INSERT INTO bounded_dispatch_evidence (id, request_id, model, status, request_json, is_payload_captured, started_at_ms) VALUES (?, ?, ?, ?, ?, 0, ?)',
    dispatchId,
    requestId.value,
    model,
    BoundedCallStatus.Running,
    contextJson,
    nowMs,
  );
}

function recordDispatchRequest({
  sql,
  dispatchId,
  requestJson,
  now,
}: SqlCall<RecordDispatchRequestInput>): DispatchRequestDecision {
  const cursor = sql.exec(
    'SELECT bounded_turns.reason, bounded_turns.deadline_at_ms, bounded_turns.ended_at_ms FROM bounded_turns JOIN bounded_dispatch_evidence ON bounded_dispatch_evidence.request_id = bounded_turns.request_id WHERE bounded_dispatch_evidence.id = ?',
    dispatchId,
  );

  const request = decodeFirst({ cursor, schema: RequestState });

  if (Option.isSome(request)) {
    const row = request.value;

    if (Option.isSome(row.reason) || Option.isSome(row.endedAt) || DateTime.isLessThanOrEqualTo(row.deadlineAt, now)) {
      return { isAllowed: false };
    }
  }

  sql.exec(
    'UPDATE bounded_dispatch_evidence SET request_json = ?, is_payload_captured = 1 WHERE id = ?',
    requestJson,
    dispatchId,
  );

  return { isAllowed: true };
}

function endDispatchEvidence({ sql, dispatchId, responseJson, status, now }: SqlCall<EndDispatchEvidenceInput>): void {
  const response = Option.getOrNull(responseJson);
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'UPDATE bounded_dispatch_evidence SET response_json = ?, status = ?, ended_at_ms = ? WHERE id = ? AND ended_at_ms IS NULL',
    response,
    status,
    nowMs,
    dispatchId,
  );
}

function dispatchEvidence({ sql, requestId }: SqlCall<BoundedRequestInput>): ReadonlyArray<DispatchEvidenceRow> {
  const cursor = sql.exec(
    'SELECT * FROM bounded_dispatch_evidence WHERE request_id = ? ORDER BY started_at_ms, id',
    requestId,
  );

  return decodeRows({ cursor, schema: DispatchEvidenceRow });
}

function interruptDispatchEvidence({ sql, now }: SqlCall<BoundedNowInput>): void {
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'UPDATE bounded_dispatch_evidence SET status = ?, ended_at_ms = ? WHERE ended_at_ms IS NULL',
    BoundedCallStatus.Unknown,
    nowMs,
  );
}
