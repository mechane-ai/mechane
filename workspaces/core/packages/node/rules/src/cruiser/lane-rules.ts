import { Lane } from '@mechane/rule-shapes';
import { ELEMENTS_CATALOG_TOOLS } from '../file-roles.ts';
import type { WorkspaceMember } from '../types.ts';
import { rootsPattern } from './roots-pattern.ts';
import type { FamilyRule } from './types.ts';

/** The modules every runtime but Node lacks, and those only the Workers runtime provides. */
const RUNTIME_MODULES = { node: { dependencyTypes: ['core'] }, workers: { path: '^cloudflare:' } } as const;

const BROWSER_LANES: ReadonlySet<Lane> = new Set([Lane.Shared, Lane.Browser]);

/** Every member that holds a source root. */
type LaneRulesInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/** The shared lane imports no Node module, and only the worker lane imports the Workers runtime's modules. */
export function laneRules({ members }: LaneRulesInput): ReadonlyArray<FamilyRule> {
  return [
    {
      subject: Lane.Shared,
      from: {
        path: rootsPattern({ members: members.filter(({ entry }) => BROWSER_LANES.has(entry.lane)) }),
        pathNot: ELEMENTS_CATALOG_TOOLS,
      },
      to: RUNTIME_MODULES.node,
    },
    {
      subject: Lane.Worker,
      from: { pathNot: rootsPattern({ members: members.filter(({ entry }) => entry.lane === Lane.Worker) }) },
      to: RUNTIME_MODULES.workers,
    },
  ];
}
