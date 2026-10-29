import { Lane } from '@mechane/rule-shapes';
import type { WorkspaceMember } from '../types.ts';
import { rootsPattern } from './roots-pattern.ts';
import type { FamilyRule } from './types.ts';

/** The modules every runtime but Node lacks, and those only the Workers runtime provides. */
const RUNTIME_MODULES = { node: { dependencyTypes: ['core'] }, workers: { path: '^cloudflare:' } } as const;

/** Every member that holds a source root. */
type LaneRulesInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/** The shared lane imports no Node module, and only the worker lane imports the Workers runtime's modules. */
export function laneRules({ members }: LaneRulesInput): ReadonlyArray<FamilyRule> {
  return [
    {
      subject: Lane.Shared,
      from: { path: rootsPattern({ members: members.filter(({ entry }) => entry.lane === Lane.Shared) }) },
      to: RUNTIME_MODULES.node,
    },
    {
      subject: Lane.Worker,
      from: { pathNot: rootsPattern({ members: members.filter(({ entry }) => entry.lane === Lane.Worker) }) },
      to: RUNTIME_MODULES.workers,
    },
  ];
}
