import { MemoryList, Watch, WatchList, WatchStatus } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { heldMech, runCli, ScriptedTool, toolCallLine } from '@mechane/testing';
import type { ScenarioFailure, TalkingMech } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { ScenarioPath } from './constants.ts';
import { ForkRecord } from './schemas.ts';
import type { ForkLines, ForkRun } from './types.ts';

/** The first line of the parent's memory, which the memory section shows as its summary; its random line follows. */
const MEMORY_SUMMARY = 'The plan before the fork';

/** The scenario's stack and mech, and the lines its memories hold. */
type ForkRunInput = { readonly stack: Stack; readonly parent: TalkingMech; readonly lines: ForkLines };

/**
 * The parent saves its memory and is forked; the fork saves its own and reads the parent's in one turn, and then the
 * parent saves another. Each one's memory and the fork's log are read once all three turns ended.
 */
export const forkRun = Effect.fn('forkRun')(function* ({
  stack,
  parent,
  lines,
}: ForkRunInput): Effect.fn.Return<ForkRun, ScenarioFailure, Scope.Scope> {
  const kept = { path: ScenarioPath.Forked, text: `${MEMORY_SUMMARY}\n${lines.parent}` };
  const write = toolCallLine({ tool: ScriptedTool.MemoryWrite, input: { path: ScenarioPath.Fork, text: lines.fork } });
  const read = toolCallLine({ tool: ScriptedTool.MemoryRead, input: { path: ScenarioPath.Forked } });

  const later = toolCallLine({
    tool: ScriptedTool.MemoryWrite,
    input: { path: ScenarioPath.Later, text: lines.parent },
  });

  const listing = { words: ['memory', 'list'], ids: [], result: MemoryList } as const;

  yield* createParentWatch({ parent });

  const saved = yield* parent.turn({ text: toolCallLine({ tool: ScriptedTool.MemoryWrite, input: kept }) });
  const { account } = parent;
  const args = ['mech', 'fork', parent.id, '--name', `${account.login}-fork`];
  const { result: record } = yield* runCli({ stack, args, environment: account.environment, result: ForkRecord });
  const fork = yield* heldMech({ stack, account, mechId: record.id, after: record.forkedFrom.sequence });
  const recalled = yield* fork.turn({ text: `${write}\n${read}` });
  const laterTurn = yield* parent.turn({ text: later });
  const forkMemory = yield* fork.command(listing);
  const parentMemory = yield* parent.command(listing);
  const forkLog = yield* fork.logged({ after: saved.ended.sequence });
  const forkWatches = yield* fork.command({ words: ['watch', 'list'], ids: [], result: WatchList });

  return { saved, record, recalled, later: laterTurn, forkMemory, parentMemory, forkLog, forkWatches };
});

const createParentWatch = Effect.fn('createParentWatch')(function* ({
  parent,
}: Pick<ForkRunInput, 'parent'>): Effect.fn.Return<Watch, ScenarioFailure> {
  return yield* parent.command({
    words: ['watch', 'set'],
    ids: [
      '--name',
      'parent-only',
      '--prompt',
      'Inspect current evidence',
      '--interval-seconds',
      '300',
      '--status',
      WatchStatus.Paused,
    ],
    result: Watch,
  });
});
