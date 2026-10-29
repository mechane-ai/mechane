import type { Finding } from '@mechane/checks-kernel';
import type { Lock } from '@mechane/program';
import { lostEntries } from '@mechane/program';

type LockFindingsInput = { readonly path: string; readonly locked: Lock; readonly current: Lock };

/** One entry of a lock, under its key. */
type LockEntry = ReturnType<typeof lostEntries>[number];

/** The task that appends to the locks what the source declares and they do not hold yet. */
const LOCK_TASK = 'mise -C workspaces/core run locks';

/**
 * A lock's findings: each entry it holds that the source no longer declares, and each entry the source declares that it
 * does not hold yet. A shipped name or a migration that ran is never renamed, edited or removed.
 */
export function lockFindings({ path, locked, current }: LockFindingsInput): ReadonlyArray<Finding> {
  const lostFinding: (lost: LockEntry) => Finding = ({ key, entry }) => ({
    check: 'locks',
    location: path,
    message: `Restore ${key}'s ${entry}, which the lock holds, and append a new entry instead, such as \`${LOCK_TASK}\` does`,
  });

  const unlockedFinding: (unlocked: LockEntry) => Finding = ({ key, entry }) => ({
    check: 'locks',
    location: path,
    message: `Append ${key}'s ${entry} to the lock, such as \`${LOCK_TASK}\` does`,
  });

  return [
    ...lostEntries({ locked, current }).map(lostFinding),
    ...lostEntries({ locked: current, current: locked }).map(unlockedFinding),
  ];
}
