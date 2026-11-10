import {
  CredentialDeletion,
  EventType,
  ExternalRequestKind,
  ExternalRequestState,
  ThreadList,
} from '@mechane/protocol';
import { Array, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { check } from '../check.ts';
import { runCli } from '../cli/run-cli.ts';
import { ScriptedTool } from '../mechs/constants.ts';
import { heldMech } from '../mechs/held-mech.ts';
import { signedInMech } from '../mechs/signed-in-mech.ts';
import { toolCallLine } from '../mechs/tool-call-line.ts';
import type { ScenarioFailure, ScenarioInput } from '../types.ts';
import { REQUEST_SERVICE_REFERENCE, requestServiceFixture } from './request-service-fixture.ts';

const CANCELED_TITLE = 'Canceled external action';
const ACCESS_TITLE = 'Approval resumes the original work';
const DENIED_TITLE = 'Denied token request';
const EXPIRED_TITLE = 'Expired external request';
const REVOKED_TITLE = 'Revoked request-service credential';
const EXPECTED_CONTINUATIONS = 3;

/** An external decision survives restart and resumes once; resolved work never restarts after a late grant. */
export const verifyRequestContinuations = Effect.fn('verifyRequestContinuations')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const service = yield* requestServiceFixture({ stack, mech });

  for (const title of [CANCELED_TITLE, ACCESS_TITLE, DENIED_TITLE, EXPIRED_TITLE]) {
    const text = toolCallLine({ tool: ScriptedTool.OpenThread, input: { title } });

    yield* mech.turn({ text });
  }

  const listed = yield* mech.command({ words: ['thread', 'list'], ids: [], result: ThreadList });
  const canceled = Array.findFirst(listed.threads, (thread) => thread.title === CANCELED_TITLE);
  const access = Array.findFirst(listed.threads, (thread) => thread.title === ACCESS_TITLE);
  const denied = Array.findFirst(listed.threads, (thread) => thread.title === DENIED_TITLE);
  const expired = Array.findFirst(listed.threads, (thread) => thread.title === EXPIRED_TITLE);

  if (Option.isNone(canceled) || Option.isNone(access)) {
    return yield* check({ name: guarantee, conditions: [false], detail: 'request work threads were not opened' });
  }

  if (Option.isNone(denied) || Option.isNone(expired)) {
    return yield* check({ name: guarantee, conditions: [false], detail: 'request work threads were not opened' });
  }

  const canceledId = service.create({ kind: ExternalRequestKind.Action });
  const deniedId = service.create({ kind: ExternalRequestKind.Vend });
  const expiredId = service.create({ kind: ExternalRequestKind.Action });

  const waitCanceled = toolCallLine({
    tool: ScriptedTool.WaitForRequest,
    input: { thread_id: canceled.value.id, kind: ExternalRequestKind.Action, request_id: canceledId },
  });

  yield* mech.turn({ text: waitCanceled });

  const requestAccess = toolCallLine({
    tool: ScriptedTool.RequestAccess,
    input: {
      thread_id: access.value.id,
      capability: 'home-links',
      reason: 'Continue the requested deployment',
      minutes: 60,
    },
  });

  const waitDenied = toolCallLine({
    tool: ScriptedTool.WaitForRequest,
    input: { thread_id: denied.value.id, kind: ExternalRequestKind.Vend, request_id: deniedId },
  });

  const waitExpired = toolCallLine({
    tool: ScriptedTool.WaitForRequest,
    input: { thread_id: expired.value.id, kind: ExternalRequestKind.Action, request_id: expiredId },
  });

  yield* mech.turn({ text: requestAccess });
  yield* mech.turn({ text: waitDenied });
  yield* mech.turn({ text: waitExpired });

  const requests = service.requests();
  const accessRequests = requests.filter((request) => request.kind === ExternalRequestKind.Access);
  const requested = Array.head(accessRequests);

  if (Option.isNone(requested)) {
    return yield* check({ name: guarantee, conditions: [false], detail: 'the host did not submit an access request' });
  }

  const resolve = toolCallLine({
    tool: ScriptedTool.UpdateThread,
    input: { thread_id: canceled.value.id, state: 'resolved' },
  });

  const resolved = yield* mech.turn({ text: resolve });

  const revokedMech = yield* signedInMech({ stack, offer: 'echo' });
  const revokedService = yield* requestServiceFixture({ stack, mech: revokedMech });
  const openRevoked = toolCallLine({ tool: ScriptedTool.OpenThread, input: { title: REVOKED_TITLE } });

  yield* revokedMech.turn({ text: openRevoked });

  const revokedThreads = yield* revokedMech.command({ words: ['thread', 'list'], ids: [], result: ThreadList });
  const revokedThread = Array.head(revokedThreads.threads);

  if (Option.isNone(revokedThread)) {
    return yield* check({ name: guarantee, conditions: [false], detail: 'the revocation work thread was not opened' });
  }

  const revokedId = revokedService.create({ kind: ExternalRequestKind.Vend });

  const waitRevoked = toolCallLine({
    tool: ScriptedTool.WaitForRequest,
    input: { thread_id: revokedThread.value.id, kind: ExternalRequestKind.Vend, request_id: revokedId },
  });

  const revoking = yield* revokedMech.turn({ text: waitRevoked });

  yield* runCli({
    stack,
    environment: revokedMech.account.environment,
    args: ['credential', 'delete', REQUEST_SERVICE_REFERENCE],
    result: CredentialDeletion,
  });

  revokedService.decide({ id: revokedId, status: ExternalRequestState.Ready });

  yield* stack.restart({ variables: {} });

  const pendingEvents = yield* mech.logged({ after: resolved.ended.sequence });
  const pendingTurns = pendingEvents.filter((event) => event.type === EventType.TurnStarted);
  const restored = yield* heldMech({ stack, account: mech.account, mechId: mech.id, after: resolved.ended.sequence });

  const revoked = yield* heldMech({
    stack,
    account: revokedMech.account,
    mechId: revokedMech.id,
    after: revoking.ended.sequence,
  });

  service.decide({ id: canceledId, status: ExternalRequestState.Ready });
  service.decide({ id: requested.value.id, status: ExternalRequestState.Ready });
  service.decide({ id: deniedId, status: ExternalRequestState.Denied });
  service.decide({ id: expiredId, status: ExternalRequestState.Expired });

  yield* restored.follower.awaitTurnEnd();
  yield* restored.follower.awaitTurnEnd();

  const last = yield* restored.follower.awaitTurnEnd();

  yield* revoked.follower.awaitTurnEnd();

  yield* stack.restart({ variables: {} });

  const reopened = yield* heldMech({ stack, account: mech.account, mechId: mech.id, after: last.sequence });

  yield* reopened.turn({ text: waitCanceled });

  const events = yield* reopened.logged({ after: resolved.ended.sequence });

  const continuations = events
    .filter((event) => event.type === EventType.InboxItemReceived)
    .filter((event) => event.text.startsWith('[Scheduled continuation]'));

  const hasReady = continuations.some(
    (event) => event.text.includes(requested.value.id) && event.text.includes('"status":"ready"'),
  );

  const hasDenied = continuations.some(
    (event) => event.text.includes(deniedId) && event.text.includes('"status":"denied"'),
  );

  const hasCanceled = continuations.some((event) => event.text.includes(canceledId));

  const hasExpired = continuations.some(
    (event) => event.text.includes(expiredId) && event.text.includes('"status":"expired"'),
  );

  const revokedEvents = yield* revokedMech.logged({ after: revoking.ended.sequence });

  const revokedContinuations = revokedEvents
    .filter((event) => event.type === EventType.InboxItemReceived)
    .filter((event) => event.text.startsWith('[Scheduled continuation]'));

  const hasRevocation = revokedContinuations.some(
    (event) => event.text.includes(revokedId) && event.text.includes('"status":"failed"'),
  );

  const completedRequests = service.requests();
  const submittedRequests = completedRequests.filter((request) => request.kind === ExternalRequestKind.Access);

  yield* check({
    name: guarantee,
    conditions: [
      pendingTurns.length === 0,
      submittedRequests.length === 1,
      continuations.length === EXPECTED_CONTINUATIONS,
      hasReady,
      hasDenied,
      hasExpired,
      revokedContinuations.length === 1,
      hasRevocation,
      !hasCanceled,
    ],
    detail: `external decisions resumed ${continuations.length} times, expired ${hasExpired}, revoked credential ${hasRevocation}, canceled work resumed ${hasCanceled}, pending model turns ${pendingTurns.length}`,
  });
});
