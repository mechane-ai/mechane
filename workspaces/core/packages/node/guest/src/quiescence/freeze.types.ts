import type { Effect } from 'effect';
import type { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';

/** The workspace snapshot and the process groups this guest may suspend in host mode. */
export type FreezeInput = WorkspaceFilesInput & { readonly ownedProcessGroups: () => ReadonlyArray<number> };

/** A process identity includes its start time so PID reuse cannot resume a different process. */
export type FreezeProcess = {
  readonly processId: number;
  readonly groupId: number;
  readonly startedAt: string;
  readonly state: string;
};

/** A temporary suspension resumes on scope exit unless a successful drain retains it until explicit release. */
export type FreezeLease = { readonly retain: () => void; readonly resume: Effect.Effect<void, WorkspaceFailed> };
