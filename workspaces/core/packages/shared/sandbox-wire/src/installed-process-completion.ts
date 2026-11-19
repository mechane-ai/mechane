import { Schema } from 'effect';
import { SandboxCompletionKind, SandboxCompletionReceipt, SandboxCompletionStatus } from './completion.ts';
import { InstalledActionOrigin } from './installed-action-origin.ts';
import { ProcessId } from './processes/process.schemas.ts';

export const InstalledProcessCompletion = Schema.Struct({
  ...SandboxCompletionReceipt.fields,
  executionId: ProcessId,
  kind: Schema.Literal(SandboxCompletionKind.Process),
  status: Schema.Literals([
    SandboxCompletionStatus.Exited,
    SandboxCompletionStatus.Stopped,
    SandboxCompletionStatus.Lost,
  ]),
  origin: InstalledActionOrigin,
});

export const InstalledCompletionObservation = Schema.OptionFromNullOr(InstalledProcessCompletion);
export const InstalledCompletionCursor = Schema.Struct({ after: Schema.OptionFromNullOr(ProcessId) });

export const InstalledCompletionPage = Schema.Struct({
  receipts: Schema.Array(InstalledProcessCompletion),
  nextAfter: Schema.OptionFromNullOr(ProcessId),
});
