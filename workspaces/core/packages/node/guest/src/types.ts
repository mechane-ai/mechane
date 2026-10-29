import type { SandboxArchive } from '@mechane/protocol';
import type { HttpStatusCode, RecordId, SourceId } from '@mechane/records';
import type { ExecutionId, ExecutionReceipt, ExecutionRequest, SourceStep, WorkspaceStep } from '@mechane/sandbox-wire';
import type { Duration, Effect } from 'effect';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  ExecutionUnstarted,
  GuestMisconfigured,
  GuestUnreachable,
  SourceGuestFailed,
  WorkspaceFailed,
} from './errors.ts';
import type { GuestEnvironment } from './schemas.ts';

/** What the guest reads from its environment, and its working folder, the home every execution starts in. */
export type GuestSettings = GuestEnvironment & { readonly home: string };

/** An execution to answer: its id, what it runs, and how long the answer waits for it to settle. */
export type AnswerInput = {
  readonly executionId: ExecutionId;
  readonly request: ExecutionRequest;
  readonly wait: Duration.Duration;
};

/** Every execution of the machine: the receipt of one, after waiting at most `wait` for it to settle. */
export type ExecutionLedger = {
  readonly answer: (input: AnswerInput) => Effect.Effect<ExecutionReceipt>;
  readonly quiesce: () => boolean;
  readonly resume: () => void;
};

/** One request to answer, and its response. */
export type Exchange = { readonly request: IncomingMessage; readonly response: ServerResponse };

/** An answer of the guest: a status, its headers, and its body. */
export type ServedAnswer = {
  readonly status: HttpStatusCode;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
};

/** Why the guest stopped serving: its environment, its listening socket, or an execution's bash failed it. */
export type GuestFailure = GuestMisconfigured | GuestUnreachable | ExecutionUnstarted;

/** A source route request addressed to one checkout and credential generation. */
export type SourceRequest = {
  readonly sourceId: SourceId;
  readonly generation: SourceId;
  readonly step: SourceStep;
  readonly request: IncomingMessage;
};

/** The source lease journal that fences commands until the controller releases its generation. */
export type SourceJournal = {
  readonly answer: (input: SourceRequest) => Effect.Effect<ServedAnswer, SourceGuestFailed>;
};

/** A workspace generation and the guest settings that locate its files. */
export type WorkspaceFilesInput = {
  readonly generation: RecordId;
  readonly folder: string;
  readonly settings: GuestSettings;
};

/** A generation to restore with its committed archive metadata. */
export type WorkspaceRestoreInput = WorkspaceFilesInput & { readonly archive: SandboxArchive };

/** One workspace route request, including its generation, operation and part index. */
export type WorkspaceRequest = {
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  readonly part: number;
  readonly request: IncomingMessage;
};

/** The guest journal that keeps archive and restore jobs alive between HTTP polls. */
export type WorkspaceJournal = {
  readonly answer: (input: WorkspaceRequest) => Effect.Effect<ServedAnswer, WorkspaceFailed>;
};
