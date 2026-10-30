import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { DistributionSettings } from '../types.ts';

export type ArchiveEntryInput = {
  readonly path: string;
  readonly entry: string;
  readonly settings: DistributionSettings;
};

/** An archive reader that remains owned by its surrounding Effect scope until extraction finishes. */
export type ArchiveProcess = ChildProcessByStdio<null, Readable, null>;
