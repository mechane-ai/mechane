import { EventType } from '@mechane/protocol';
import { check, ScriptedTool, signedInMech, TEXT_BYTES } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { randomBytes } from 'node:crypto';
import { briefedDrone } from './briefed-drone.ts';
import { ScenarioPath } from './constants.ts';
import { savedThread } from './saved-thread.ts';

/**
 * A mech saves a memory and opens a thread, then one turn writes a draft, starts a drone on the thread, and waits at a
 * gate. The drone is refused memory_write and start_drone as not available, and its report holds the saved memory,
 * never the draft its mech saved after it started. Memory then holds the saved memory and the draft alone, and only
 * pi's refusal shows the drone was never offered memory_write, whose change no reply would save.
 */
export const droneReadsMemoryAsSavedAtItsStart = Effect.fn('droneReadsMemoryAsSavedAtItsStart')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const kept = `kept ${randomBytes(TEXT_BYTES).toString('hex')}`;
  const draft = `draft ${randomBytes(TEXT_BYTES).toString('hex')}`;
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const thread = yield* savedThread({ mech, kept });
  const { saved, ended, paths } = yield* briefedDrone({ stack, mech, thread, draft });

  const isSavedMemoryReported =
    ended.type === EventType.DroneReported && ended.report.includes(kept) && !ended.report.includes(draft);

  const isRefused: (tool: string) => boolean = (tool) =>
    ended.type === EventType.DroneReported && ended.report.includes(`Tool ${tool} is not available`);

  yield* check({
    name: guarantee,
    conditions: [
      saved.type === EventType.TurnAnswered,
      isSavedMemoryReported && [ScriptedTool.MemoryWrite, ScriptedTool.StartDrone].every(isRefused),
      paths.join(',') === [ScenarioPath.Draft, ScenarioPath.Kept].join(','),
    ],
    detail: `the draft's turn ended ${saved.type}; the drone ended ${JSON.stringify(ended)}; memory then held ${JSON.stringify(paths)}`,
  });
}, Effect.scoped);
