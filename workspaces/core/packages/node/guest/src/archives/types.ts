import type { Deferred } from 'effect';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { WorkspaceFailed } from '../errors.ts';

/** The tar process and the completion signal used by the bounded compression pipeline. */
export type ArchiveProcess = {
  /** Standard input is absent; tar emits its archive and diagnostics through separate pipes. */
  readonly child: ChildProcessByStdio<null, Readable, Readable>;
  readonly exited: Deferred.Deferred<void, WorkspaceFailed>;
};
