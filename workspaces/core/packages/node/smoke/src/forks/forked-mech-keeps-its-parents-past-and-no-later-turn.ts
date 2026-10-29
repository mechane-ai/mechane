import { check, signedInMech, TEXT_BYTES } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { randomBytes } from 'node:crypto';
import { forkRun } from './fork-run.ts';
import { isolationConditions } from './isolation-conditions.ts';
import { runDetail } from './run-detail.ts';

/**
 * A mech saves a memory and a member forks it; the fork's first request holds the memory's random line, which only the
 * copied conversation carries. The fork's read finds the memory in its own copy, then the fork and the parent each save
 * one more, and neither memory holds the other's. The parent's requests never hold the fork's line, the fork's log runs
 * from `mech.forked` to its own turn, and each names one provider session of its own.
 */
export const forkedMechKeepsItsParentsPastAndNoLaterTurn = Effect.fn('forkedMechKeepsItsParentsPastAndNoLaterTurn')(
  function* ({ stack, guarantee }: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
    const lines = {
      parent: `kept ${randomBytes(TEXT_BYTES).toString('hex')}`,
      fork: `forked ${randomBytes(TEXT_BYTES).toString('hex')}`,
    };

    const parent = yield* signedInMech({ stack, offer: 'echo' });
    const run = yield* forkRun({ stack, parent, lines });

    yield* check({
      name: guarantee,
      conditions: isolationConditions({ run, parentId: parent.id, lines }),
      detail: runDetail({ run }),
    });
  },
  Effect.scoped,
);
