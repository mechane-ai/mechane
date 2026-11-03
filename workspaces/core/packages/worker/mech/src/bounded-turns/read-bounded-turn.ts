import type { BoundedTurnRow, DispatchEvidenceRow, MechRow } from '@mechane/mech-store';
import { BoundedCallStatus, BoundedTurnStatus, DispatchStatus } from '@mechane/protocol';
import type { BoundedDispatchEvidence, BoundedTurn, Dispatch } from '@mechane/protocol';
import { BoundedRequestId, Tokens } from '@mechane/records';
import { BoundedTurnAnswer, WorkDispatchesAnswer, workspaceStub } from '@mechane/rpc';
import type { BoundedTurnInput } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import type { OpenedMech } from '../types.ts';
import { redactBoundedEvidence } from './redact-bounded-evidence.ts';

type ReadBoundedInput = BoundedTurnInput & { readonly mech: OpenedMech };
type ModelEvidenceInput = { readonly evidence: DispatchEvidenceRow };
type RequestInput = { readonly request: BoundedTurnRow };

type CompletionInput = {
  readonly request: BoundedTurnRow;
  readonly dispatches: ReadonlyArray<Dispatch>;
  readonly evidence: ReadonlyArray<DispatchEvidenceRow>;
};

type EvidenceCompletionInput = CompletionInput & {
  readonly hasPendingCancellation: boolean;
  readonly hasUnknownTools: boolean;
};

const INCOMPLETE_EVIDENCE_STATUSES: ReadonlySet<BoundedCallStatus> = new Set([
  BoundedCallStatus.Running,
  BoundedCallStatus.Unknown,
]);

/** Joins durable request state, the workspace ledger, and Pi's committed tool results. */
export async function readBoundedTurn({ mech, requestId }: ReadBoundedInput): Promise<BoundedTurnAnswer> {
  const snapshot = await mech.store.atomic({
    run: (store) => ({
      definition: store.mech(),
      request: store.boundedTurn({ requestId }),
      evidence: store.dispatchEvidence({ requestId }),
      cancellations: store.boundedTurnCancellations(),
    }),
  });

  if (Option.isNone(snapshot.definition)) {
    return BoundedTurnAnswer.cases.MechMissing.make({});
  }

  if (Option.isNone(snapshot.request)) {
    return BoundedTurnAnswer.cases.RequestMissing.make({});
  }

  const request = snapshot.request.value;
  const definition = snapshot.definition.value;

  const dispatches = await readDispatches({
    mech,
    request,
    workspaceId: definition.workspaceId,
    mechId: definition.id,
  });

  const tools = await mech.harness.readTurnEvidence({ inboxItemId: requestId });
  const dispatchEvidence = snapshot.evidence.map((evidence) => modelEvidence({ evidence }));
  const unknowns = evidenceUnknowns({ request, dispatches, evidence: snapshot.evidence });
  const hasPendingCancellation = snapshot.cancellations.some((id) => id === requestId);
  const hasUnknownTools = tools.unknowns.length > 0;

  const isComplete = isEvidenceComplete({
    request,
    dispatches,
    evidence: snapshot.evidence,
    hasPendingCancellation,
    hasUnknownTools,
  });

  const boundedTurn: BoundedTurn = {
    requestId: BoundedRequestId.make(requestId),
    status: requestStatus({ request }),
    receivedAt: request.receivedAt,
    deadlineAt: request.deadlineAt,
    maxModelDispatches: request.maxModelDispatches,
    maxOutputTokens: Tokens.make(request.maxOutputTokens),
    dispatchedCount: request.dispatchedCount,
    turnId: request.turnId,
    endedAt: request.endedAt,
    reply: request.reply,
    reason: request.reason,
    isEvidenceComplete: isComplete,
    dispatches,
    dispatchEvidence,
    toolCalls: tools.toolCalls,
    unknowns: [...unknowns, ...tools.unknowns],
  };

  const modelApiKey = await mech.settings.modelApiKey();
  const redacted = redactBoundedEvidence({ boundedTurn, modelApiKey });

  return BoundedTurnAnswer.cases.Found.make({ boundedTurn: redacted });
}

type ReadDispatchesInput = {
  readonly mech: OpenedMech;
  readonly request: BoundedTurnRow;
  readonly workspaceId: MechRow['workspaceId'];
  readonly mechId: MechRow['id'];
};

async function readDispatches({
  mech,
  request,
  workspaceId,
  mechId,
}: ReadDispatchesInput): Promise<ReadonlyArray<Dispatch>> {
  if (Option.isNone(request.turnId)) {
    return [];
  }

  const encoded = await workspaceStub({ bindings: mech.settings, workspaceId }).workDispatches({
    mechId,
    workId: request.turnId.value,
  });

  return await Schema.decodeUnknownPromise(WorkDispatchesAnswer)(encoded);
}

function modelEvidence({ evidence }: ModelEvidenceInput): BoundedDispatchEvidence {
  const request = providerRequest({ evidence });

  return {
    id: evidence.id,
    model: evidence.model,
    status: evidence.status,
    request,
    response: evidence.response,
    startedAt: evidence.startedAt,
    endedAt: evidence.endedAt,
  };
}

function providerRequest({ evidence }: ModelEvidenceInput): BoundedDispatchEvidence['request'] {
  if (!evidence.isPayloadCaptured) {
    return null;
  }

  return evidence.request;
}

function requestStatus({ request }: RequestInput): BoundedTurn['status'] {
  if (Option.isSome(request.endedAt)) {
    if (Option.isSome(request.reason)) {
      return BoundedTurnStatus.Unanswered;
    }

    return BoundedTurnStatus.Answered;
  }

  if (Option.isSome(request.turnId)) {
    return BoundedTurnStatus.Running;
  }

  return BoundedTurnStatus.Queued;
}

function isEvidenceComplete({
  request,
  dispatches,
  evidence,
  hasPendingCancellation,
  hasUnknownTools,
}: EvidenceCompletionInput): boolean {
  if (Option.isNone(request.endedAt) || dispatches.length !== request.dispatchedCount) {
    return false;
  }

  if (
    hasPendingCancellation ||
    hasUnknownTools ||
    dispatches.some((dispatch) => dispatch.status === DispatchStatus.Reserved)
  ) {
    return false;
  }

  if (evidence.some((call) => INCOMPLETE_EVIDENCE_STATUSES.has(call.status))) {
    return false;
  }

  return dispatches.every(
    (dispatch) => dispatch.status === DispatchStatus.Refused || evidence.some((call) => call.id === dispatch.id),
  );
}

function evidenceUnknowns({ request, dispatches, evidence }: CompletionInput): ReadonlyArray<string> {
  const contextOnly = evidence
    .filter((call) => !call.isPayloadCaptured)
    .map(({ id }) => `Dispatch ${id} has no captured provider request payload.`);

  const incomplete = evidence
    .filter((call) => call.status === BoundedCallStatus.Unknown)
    .map(({ id }) => `Dispatch ${id} was interrupted; its provider response and usage may be unknown.`);

  const missing = dispatches
    .filter(
      (dispatch) => dispatch.status !== DispatchStatus.Refused && !evidence.some((call) => call.id === dispatch.id),
    )
    .map(({ id }) => `Dispatch ${id} has ledger accounting but no retained request or response.`);

  if (dispatches.length !== request.dispatchedCount) {
    return [
      ...contextOnly,
      ...incomplete,
      ...missing,
      'A dispatch claim has no confirmed ledger record; its execution outcome is unknown.',
    ];
  }

  return [...contextOnly, ...incomplete, ...missing];
}
