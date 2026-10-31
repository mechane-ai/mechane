import { SandboxReport } from '@mechane/protocol';
import { COMMAND_PREFIX, startCloudflareStack } from '@mechane/stack';
import type { Stack } from '@mechane/stack';
import { check, heldMech, roundtripWorkspace, signedInMech } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput, TalkingMech } from '@mechane/testing';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { commandReply } from '../hands/command-reply.ts';

const CONTENTS = 'workerd-persistent-home';
const FILE = 'saved-workspace.txt';

/** Exercises the shipped Worker, Durable Objects, and R2 against real guest processes with a scripted model. */
export const cloudflareRestoresWorkspace = Effect.fn('cloudflareRestoresWorkspace')(function* ({
  stack: local,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const stack = yield* startCloudflareStack({ settings: local.settings });
  const saved = yield* savedWorkspace({ stack });

  yield* stack.restart({ variables: {} });

  const mech = yield* heldMech({ stack, ...saved });

  const restored = yield* commandReply({ mech, command: `cat ${FILE}` });
  const shown = yield* mech.command({ words: ['sandbox', 'show'], ids: [], result: SandboxReport });
  const hasFiles = restored.includes(CONTENTS);
  const hasArchive = Option.isSome(shown.archive);

  yield* check({
    name: guarantee,
    conditions: [hasFiles, hasArchive],
    detail: `restored files after export, import, machine replacement, and workerd restart: ${hasFiles}`,
  });
}, Effect.scoped);

type SavedWorkspace = {
  readonly mechId: TalkingMech['id'];
  readonly account: TalkingMech['account'];
  readonly after: number;
};

type SavedWorkspaceInput = { readonly stack: Stack };

/** Closes the live follower before workerd restarts; the next client resumes from its retained event sequence. */
const savedWorkspace = Effect.fn('savedWorkspace')(function* ({
  stack,
}: SavedWorkspaceInput): Effect.fn.Return<SavedWorkspace, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const written = yield* mech.turn({ text: `${COMMAND_PREFIX}echo ${CONTENTS} > ${FILE}` });

  yield* roundtripWorkspace({ stack, mech });

  return { mechId: mech.id, account: mech.account, after: written.ended.sequence };
}, Effect.scoped);
