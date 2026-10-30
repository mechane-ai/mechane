import {
  bootstrapSharedWorkspace,
  pauseQueuedWorkspace,
  queueWorkspaceTurns,
  verifyWorkspacePolicyBudget,
  verifyWorkspacePolicySandboxes,
} from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { privateIdentitiesCannotSpend } from './private-identities-cannot-spend.ts';

/** Workspace policy changes govern retained agents without restarting their objects. */
export const workspacePolicyCutsOffQueuedWorkImmediately = Effect.fn('workspacePolicyCutsOffQueuedWorkImmediately')(
  function* ({ stack, guarantee }: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
    const { owner: administrator } = yield* bootstrapSharedWorkspace({ stack });
    const subject = yield* queueWorkspaceTurns({ stack });
    const original = yield* pauseQueuedWorkspace({ stack, administrator, subject });

    yield* verifyWorkspacePolicyBudget({ stack, administrator, subject, original });
    yield* verifyWorkspacePolicySandboxes({ stack, administrator });
    yield* stack.restart({ variables: {} });
    yield* privateIdentitiesCannotSpend({ stack, guarantee });
  },
  Effect.scoped,
);
