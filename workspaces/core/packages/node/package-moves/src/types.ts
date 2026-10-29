import type { FileUnwritable, InputUnreadable } from '@mechane/checks-kernel';
import type { ProcessFailed } from '@mechane/program';
import type { MoveRefused } from './errors.ts';

/** Every failure a run of the move program ends with. */
export type MoveFailure = InputUnreadable | FileUnwritable | MoveRefused | ProcessFailed;
