import { SandboxReport } from '@mechane/protocol';
import { LOCAL_OWNER_IDENTITY } from '@mechane/records';
import { Array, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { RefusalCode } from '../constants.ts';
import { commandReply } from '../mechs/command-reply.ts';
import { heldMech } from '../mechs/held-mech.ts';
import { talkingMech } from '../mechs/talking-mech.ts';
import type { TalkingMech } from '../mechs/types.ts';
import { refuseUnadmittedSource } from '../sources/refuse-unadmitted-source.ts';
import type { Account, ScenarioFailure, StackInput } from '../types.ts';
import { changeWorkspacePolicy } from './change-workspace-policy.ts';
import { signedInWorkspaceMech } from './signed-in-workspace-mech.ts';

type CapacityInput = StackInput & { readonly administrator: Account };

type RetainedCapacity = {
  readonly account: Account;
  readonly holderId: TalkingMech['id'];
  readonly contenderId: TalkingMech['id'];
  readonly holderAfter: number;
  readonly contenderAfter: number;
};

const CONTENTS = 'retained-capacity-files';
const FULL_MESSAGE = 'command did not run';

/** One quota covers commands, source work and maintenance, including machines retained after a failed file save. */
export const verifySandboxCapacity = Effect.fn('verifySandboxCapacity')(function* ({
  stack,
  administrator,
}: CapacityInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const saved = yield* retainFailedSave({ stack, administrator });
  const administratorIdentities = JSON.stringify([LOCAL_OWNER_IDENTITY]);

  yield* stack.restart({ variables: { administratorIdentities } });

  const holder = yield* heldMech({ stack, account: saved.account, mechId: saved.holderId, after: saved.holderAfter });

  const contender = yield* heldMech({
    stack,
    account: saved.account,
    mechId: saved.contenderId,
    after: saved.contenderAfter,
  });

  const blocked = yield* commandReply({ mech: contender, command: 'echo unexpected-machine' });
  const recovered = yield* commandReply({ mech: holder, command: 'chmod 700 unreadable; cat retained.txt' });

  const isBlocked = blocked.includes(FULL_MESSAGE);
  const hasRecoveredFiles = recovered.includes(CONTENTS);

  yield* check({
    name: 'a failed save retains its machine capacity and live files across Worker restart',
    conditions: [isBlocked, hasRecoveredFiles],
    detail: `capacity retained ${isBlocked}; files recovered ${hasRecoveredFiles}`,
  });

  const refused = yield* refusedCli({
    stack,
    environment: contender.account.environment,
    args: ['sandbox', 'upgrade', contender.id],
  });

  yield* check({
    name: 'maintenance shares the command machine limit',
    conditions: [refused.code === RefusalCode.SandboxCapacityReached],
    detail: refused.code,
  });

  const pending = yield* contender.command({ words: ['sandbox', 'show'], ids: [], result: SandboxReport });
  const operationId = Option.getOrElse(pending.operationId, () => 'missing-operation');

  // These are disposable fixture files, already read back above. Deletion must return capacity only after stop.
  yield* holder.command({ words: ['sandbox', 'delete'], ids: ['--confirm'], result: SandboxReport });
  yield* contender.command({
    words: ['sandbox', 'upgrade'],
    ids: ['--operation-id', operationId],
    result: SandboxReport,
  });

  const admitted = yield* commandReply({ mech: contender, command: `echo ${CONTENTS}` });

  const isAdmitted = admitted.includes(CONTENTS);

  yield* check({
    name: 'confirmed machine stop returns capacity and a refused maintenance operation can resume',
    conditions: [isAdmitted],
    detail: `next machine admitted ${isAdmitted}`,
  });
}, Effect.scoped);

/** Close event followers before crashing the Worker; the host guest and its unreadable directory remain live. */
const retainFailedSave = Effect.fn('retainFailedSave')(function* ({
  stack,
  administrator,
}: CapacityInput): Effect.fn.Return<RetainedCapacity, ScenarioFailure, Scope.Scope> {
  const { mech: holder, workspaceId } = yield* signedInWorkspaceMech({ stack });

  yield* changeWorkspacePolicy({ stack, administrator, workspaceId, changes: { hasSandboxes: true, machines: 1 } });

  const account = holder.account;
  const model = stack.modelUpstream.offers.echo.id;
  const contender = yield* talkingMech({ stack, account, model });
  const sourceProbe = yield* talkingMech({ stack, account, model });

  const failed = yield* commandReply({
    mech: holder,
    command: `echo ${CONTENTS} > retained.txt; mkdir unreadable; chmod 000 unreadable`,
  });

  const blocked = yield* commandReply({ mech: contender, command: 'echo unexpected-machine' });

  const hasFailedSave = failed.includes('files could not be saved');
  const isBlocked = blocked.includes(FULL_MESSAGE);

  yield* check({
    name: 'a machine retained after archive failure still consumes workspace capacity',
    conditions: [hasFailedSave, isBlocked],
    detail: `save failed ${hasFailedSave}; capacity held ${isBlocked}`,
  });
  yield* refuseUnadmittedSource({ stack, mech: sourceProbe });

  const holderEvents = yield* holder.logged({ after: 0 });
  const contenderEvents = yield* contender.logged({ after: 0 });
  const holderLast = Array.last(holderEvents);
  const contenderLast = Array.last(contenderEvents);
  const holderAfter = Option.match(holderLast, { onNone: () => 0, onSome: (event) => event.sequence });
  const contenderAfter = Option.match(contenderLast, { onNone: () => 0, onSome: (event) => event.sequence });

  return { account, holderId: holder.id, contenderId: contender.id, holderAfter, contenderAfter };
}, Effect.scoped);
