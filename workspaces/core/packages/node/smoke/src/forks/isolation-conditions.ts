import { EventType } from '@mechane/protocol';
import { Array, Option } from 'effect';
import { ScenarioPath } from './constants.ts';
import { memoryPaths } from './memory-paths.ts';
import { sessions } from './sessions.ts';
import type { ForkLines, ForkRun } from './types.ts';

/** What the scenario saw, the parent's id, and the lines its memories hold. */
type IsolationConditionsInput = { readonly run: ForkRun; readonly parentId: string; readonly lines: ForkLines };

/** A request the scripted upstream answered, by its body. */
type RequestBody = { readonly body: string };

/**
 * The conditions that the fork began at the parent's last event with its conversation and memory. They also hold that
 * neither one's later turn reached the other's memory, log, requests or provider session.
 */
export function isolationConditions({ run, parentId, lines }: IsolationConditionsInput): ReadonlyArray<boolean> {
  const { saved, record, recalled, later, forkMemory, parentMemory, forkLog } = run;
  const parentSessions = sessions({ turns: [saved, later] });
  const forkSessions = sessions({ turns: [recalled] });
  const isForkFree: (request: RequestBody) => boolean = ({ body }) => !body.includes(lines.fork);

  return [
    [saved, later].every(({ ended }) => ended.type === EventType.TurnAnswered),
    record.forkedFrom.mechId === parentId,
    record.forkedFrom.sequence === saved.ended.sequence,
    Option.exists(Array.head(recalled.requests), ({ body }) => body.includes(lines.parent)),
    recalled.ended.type === EventType.TurnAnswered && recalled.ended.reply.includes(lines.parent),
    later.requests.every(isForkFree),
    memoryPaths({ memory: forkMemory }) === [ScenarioPath.Fork, ScenarioPath.Forked].join(','),
    memoryPaths({ memory: parentMemory }) === [ScenarioPath.Forked, ScenarioPath.Later].join(','),
    Option.exists(Array.head(forkLog), ({ type }) => type === EventType.MechForked),
    Option.exists(Array.last(forkLog), ({ sequence }) => sequence === recalled.ended.sequence),
    parentSessions.length === 1,
    forkSessions.length === 1,
    !parentSessions.some((session) => forkSessions.includes(session)),
    run.forkWatches.watches.length === 0,
  ];
}
