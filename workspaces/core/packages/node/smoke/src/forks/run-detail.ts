import { memoryPaths } from './memory-paths.ts';
import { sessions } from './sessions.ts';
import type { ForkRun } from './types.ts';

/** What the scenario saw. */
type RunInput = { readonly run: ForkRun };

/** What the scenario saw, as its check's detail. */
export function runDetail({ run }: RunInput): string {
  const { saved, record, recalled, later, forkMemory, parentMemory, forkLog } = run;
  const ends = [saved, recalled, later].map(({ ended }) => ended.type).join(', ');
  const parentSessions = sessions({ turns: [saved, later] }).join(', ');
  const forkSessions = sessions({ turns: [recalled] }).join(', ');

  return `the fork answered ${JSON.stringify(record)}; the turns ended ${ends}; the fork's memory held ${memoryPaths({ memory: forkMemory })} and the parent's ${memoryPaths({ memory: parentMemory })}; the fork's log after the fork point held ${forkLog.map(({ type }) => type).join(', ')}; the parent named sessions ${parentSessions} and the fork ${forkSessions}`;
}
