import type { Thread } from '@mechane/protocol';
import { ScriptedTool, toolCallLine } from '@mechane/testing';
import type { ScenarioFailure, TalkingMech } from '@mechane/testing';
import { Effect } from 'effect';
import { ScenarioPath } from './constants.ts';
import { OneThread } from './schemas.ts';

/** The scenario's mech, and the memory its first turn saves. */
type SavedThreadInput = { readonly mech: TalkingMech; readonly kept: string };

/** Saves the kept memory and opens a thread in one turn, and answers the thread. */
export const savedThread = Effect.fn('savedThread')(function* ({
  mech,
  kept,
}: SavedThreadInput): Effect.fn.Return<Thread, ScenarioFailure> {
  const save = toolCallLine({ tool: ScriptedTool.MemoryWrite, input: { path: ScenarioPath.Kept, text: kept } });
  const open = toolCallLine({ tool: ScriptedTool.OpenThread, input: { title: 'Read the memory' } });

  yield* mech.turn({ text: `${save}\n${open}` });

  const {
    threads: [thread],
  } = yield* mech.command({ words: ['thread', 'list'], ids: [], result: OneThread });

  return thread;
});
