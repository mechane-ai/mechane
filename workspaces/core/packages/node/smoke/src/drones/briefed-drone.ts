import { Delivery, Drone, MemoryList } from '@mechane/protocol';
import type { Thread } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import type { Stack } from '@mechane/stack';
import { commandGate, ScriptedTool, toolCallLine } from '@mechane/testing';
import type { CommandGate, DroneEndEvent, ScenarioFailure, TalkingMech, TurnEndEvent } from '@mechane/testing';
import { Effect, Schema } from 'effect';
import { ScenarioPath } from './constants.ts';

/** A mech's drones as `mechane drone list` answers them, when the mech started one. */
const OneDrone = Schema.Struct({ drones: Schema.Tuple([Drone]) });

type OneDrone = typeof OneDrone.Type;

/** The scenario's mech, the thread its drone works on, and the draft its turn writes. */
type BriefedDroneInput = {
  readonly stack: Stack;
  readonly mech: TalkingMech;
  readonly thread: Thread;
  readonly draft: string;
};

/** The end of the draft's turn, the end of the drone that turn started, and the paths of the mech's memories after. */
type BriefedDrone = {
  readonly saved: TurnEndEvent;
  readonly ended: DroneEndEvent;
  readonly paths: ReadonlyArray<string>;
};

/** The thread the drone works on, and the gate it waits at. */
type DroneBriefInput = { readonly thread: Thread; readonly gate: CommandGate };

/**
 * Writes the draft, starts the drone on the thread, and waits at the mech's gate, all in one turn. Once the drone waits
 * at its own gate, opens the mech's, and once that turn has saved the draft, opens the drone's. Then reads the mech's
 * one drone, whose start_drone call ran before its gate, follows it to its end, and lists the paths of the mech's
 * memories.
 */
export const briefedDrone = Effect.fn('briefedDrone')(function* ({
  stack,
  mech,
  thread,
  draft,
}: BriefedDroneInput): Effect.fn.Return<BriefedDrone, ScenarioFailure> {
  const mechGate = yield* commandGate({ stack });
  const droneGate = yield* commandGate({ stack });

  const turn = [
    toolCallLine({ tool: ScriptedTool.MemoryWrite, input: { path: ScenarioPath.Draft, text: draft } }),
    toolCallLine({
      tool: ScriptedTool.StartDrone,
      input: { thread_id: thread.id, brief: droneBrief({ thread, gate: droneGate }) },
    }),
    `${COMMAND_PREFIX}${mechGate.bash}`,
  ];

  yield* mech.send({ text: turn.join('\n'), delivery: Delivery.WhenIdle });
  yield* droneGate.awaitRun;
  yield* mechGate.open;

  const saved = yield* mech.follower.awaitTurnEnd();

  yield* droneGate.open;

  const {
    drones: [drone],
  } = yield* mech.command({ words: ['drone', 'list'], ids: [], result: OneDrone });

  const ended = yield* mech.follower.awaitDroneEnd({ droneId: drone.id });
  const { memories } = yield* mech.command({ words: ['memory', 'list'], ids: [], result: MemoryList });

  return { saved, ended, paths: memories.map((memory) => memory.path) };
});

/**
 * What the drone is told to do: write a memory, start a drone, read the kept memory and the draft, wait at its gate,
 * and read the draft again.
 */
function droneBrief({ thread, gate }: DroneBriefInput): string {
  const readDraft = toolCallLine({ tool: ScriptedTool.MemoryRead, input: { path: ScenarioPath.Draft } });

  return [
    toolCallLine({ tool: ScriptedTool.MemoryWrite, input: { path: ScenarioPath.Drone, text: 'mine' } }),
    toolCallLine({ tool: ScriptedTool.StartDrone, input: { thread_id: thread.id, brief: `${COMMAND_PREFIX}true` } }),
    toolCallLine({ tool: ScriptedTool.MemoryRead, input: { path: ScenarioPath.Kept } }),
    readDraft,
    `${COMMAND_PREFIX}${gate.bash}`,
    readDraft,
  ].join('\n');
}
