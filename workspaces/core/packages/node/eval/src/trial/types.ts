import type { OperationCall } from '@mechane/client';
import type { catalog, OperationInput } from '@mechane/protocol';
import type { Case, CreationIntent, Intent, Suite } from '../schemas.ts';
import type { Trial } from '../store/schemas.ts';
import type { OnceFile, TrialFiles, WorkspaceAccess, WriteProgress } from '../types.ts';

/** The operations a trial's turns call. */
type TrialOperation = 'createMech' | 'sendNotification' | 'listTurns' | 'showTurn' | 'listConsoleMessages';

/** One trial of a plan to run: its case, the suite's settings, its files, and where it writes its progress. */
export type RunTrialInput = {
  readonly call: OperationCall<TrialOperation>;
  readonly access: WorkspaceAccess;
  readonly suite: Suite;
  readonly evalCase: Case;
  readonly trial: Trial;
  readonly files: TrialFiles;
  readonly writeProgress: WriteProgress;
};

/** The fields of the mech a role's turn creates, beside the workspace it is created in. */
type MechSettings = Omit<OperationInput<(typeof catalog)['createMech']>, 'workspaceId'>;

/** A role's turn: the mech to create for it, the text it receives, and the file of its intent. */
export type RoleTurnInput = {
  readonly call: OperationCall<TrialOperation>;
  readonly access: WorkspaceAccess;
  readonly mech: MechSettings;
  readonly text: string;
  readonly creation: OnceFile<CreationIntent>;
  readonly intent: OnceFile<Intent>;
};
