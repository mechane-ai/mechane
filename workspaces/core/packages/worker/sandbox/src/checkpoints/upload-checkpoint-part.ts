import { HttpMethod } from '@mechane/records';
import { FileCheckpointResult } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Duration, Option, Result, Schema } from 'effect';
import { Hex } from 'effect/encoding';
import { ANSWER_SLACK } from '../constants.ts';
import { WorkspaceTransferFailed, WorkspaceTransferPhase } from '../errors.ts';
import { readArchivePart } from '../files/read-archive-part.ts';
import type { GuestConnection } from '../types.ts';
import { observeWorkspaceTransfer } from '../workspace/observe-workspace-transfer.ts';
import { snapshotPartBytes } from '../workspace/snapshots/snapshot-part-bytes.ts';
import { workspacePartKey } from '../workspace/workspace-part-key.ts';
import { workspaceRequest } from '../workspace/workspace-request.ts';
import { checkpointDeadline } from './checkpoint-deadline.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import type { ArchivedCheckpointInput } from './types.ts';

type UploadCheckpointPartInput = Pick<ArchivedCheckpointInput, 'store' | 'checkpoint' | 'archive' | 'workspace'> & {
  readonly guest: GuestConnection;
  readonly part: number;
};

/** Stores one validated archive part with an R2 checksum under its batch's unchanged checkpoint fence. */
export async function uploadCheckpointPart({
  checkpoint,
  archive,
  workspace,
  store,
  guest,
  part,
}: UploadCheckpointPartInput): Promise<void> {
  const { generation } = checkpoint;
  const bytes = await readCheckpointPart({ store, checkpoint, archive, guest, part });
  const selectedPart = Option.some(part);
  const key = workspacePartKey({ owner: workspace.owner, generation, part: selectedPart });
  const sha256 = await crypto.subtle.digest('SHA-256', bytes);

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  const uploaded = await workspace.bucket.put(key, bytes, {
    sha256,
    customMetadata: { archiveSha256: archive.sha256 },
    onlyIf: { etagDoesNotMatch: '*' },
  });

  const stored = Option.fromNullishOr(uploaded);

  if (Option.isSome(stored)) {
    return;
  }

  const found = await workspace.bucket.head(key);
  const existing = Option.fromNullishOr(found);
  const recorded = Option.flatMap(existing, (value) => Option.fromUndefinedOr(value.checksums.sha256));
  const expectedBytes = new Uint8Array(sha256);
  const expected = Hex.encode(expectedBytes);

  const actual = Option.map(recorded, (value) => {
    const digestBytes = new Uint8Array(value);

    return Hex.encode(digestBytes);
  });

  const size = Option.map(existing, (value) => value.size);
  const metadata = Option.flatMap(existing, (value) => Option.fromNullishOr(value.customMetadata));
  const archiveDigest = Option.map(metadata, (value) => value['archiveSha256']);

  const isMatching =
    Option.contains(size, bytes.byteLength) &&
    Option.contains(actual, expected) &&
    Option.contains(archiveDigest, archive.sha256);

  if (isMatching) {
    return;
  }

  const cause = new WorkspaceTransferFailed({
    generation,
    step: WorkspaceStep.Part,
    reason: 'immutable archive part conflicts with its checkpoint',
  });

  const failure = Result.fail(cause);

  Result.getOrThrow(failure);
}

type ReadCheckpointPartInput = Pick<UploadCheckpointPartInput, 'store' | 'checkpoint' | 'archive' | 'guest' | 'part'>;

async function readCheckpointPart({
  store,
  checkpoint,
  archive,
  guest,
  part,
}: ReadCheckpointPartInput): Promise<Uint8Array<ArrayBuffer>> {
  const { generation, machineId } = checkpoint;
  const selectedPart = Option.some(part);
  const snapshot = { generation, parent: checkpoint.parent, archive };
  const response = await requestCheckpointPart({ store, checkpoint, guest, part });

  const observedResponse = Option.some(response);

  const bytes = await observeWorkspaceTransfer({
    machineId,
    generation,
    step: WorkspaceStep.Part,
    part: selectedPart,
    phase: WorkspaceTransferPhase.ResponseBody,
    failurePhase: 'body',
    response: observedResponse,
    run: () => readArchivePart({ response }),
  });

  const expected = snapshotPartBytes({ snapshot, part });

  if (bytes.byteLength !== expected) {
    const cause = new WorkspaceTransferFailed({
      generation,
      step: WorkspaceStep.Part,
      reason: 'archive part has the wrong byte count',
    });

    const failure = Result.fail(cause);

    Result.getOrThrow(failure);
  }

  return bytes;
}

type RequestCheckpointPartInput = Omit<ReadCheckpointPartInput, 'archive'>;

/** Repeats only a timed-out read of the same immutable part while its required checkpoint is still pending. */
async function requestCheckpointPart({
  store,
  checkpoint,
  guest,
  part,
}: RequestCheckpointPartInput): Promise<Response> {
  const { generation, machineId } = checkpoint;

  const request = {
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Part,
    part: Option.some(part),
    lease: Option.none<number>(),
    init: { method: HttpMethod.Get },
  };

  const promise = workspaceRequest(request);
  const first = await capturePromise({ promise });

  if (Result.isSuccess(first)) {
    return first.success;
  }

  const timeout = checkpointPartRetryTimeout({ store, checkpoint, cause: first.failure });

  if (Option.isNone(timeout)) {
    return Result.getOrThrow(first);
  }

  const timeoutMs = Duration.toMillis(timeout.value);
  const signal = AbortSignal.timeout(timeoutMs);

  return await workspaceRequest({ ...request, init: { ...request.init, signal } });
}

type CheckpointPartRetryInput = Pick<ReadCheckpointPartInput, 'store' | 'checkpoint'> & { readonly cause: unknown };

function checkpointPartRetryTimeout({
  store,
  checkpoint,
  cause,
}: CheckpointPartRetryInput): Option.Option<Duration.Duration> {
  if (!Schema.is(WorkspaceTransferFailed)(cause)) {
    return Option.none();
  }

  const observation = Option.fromUndefinedOr(cause.observation);

  const isRequestTimeout = Option.exists(
    observation,
    ({ phase, isTimedOut }) => phase === WorkspaceTransferPhase.Request && isTimedOut,
  );

  if (!isRequestTimeout) {
    return Option.none();
  }

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return Option.none();
  }

  const operation = store.readFileCheckpoint({ purpose: checkpoint.purpose });
  const pending = Option.filter(operation, ({ result }) => FileCheckpointResult.guards.Pending(result));

  return Option.flatMap(pending, ({ startedAt }) => {
    const now = DateTime.nowUnsafe();
    const deadline = checkpointDeadline({ purpose: checkpoint.purpose, startedAt });
    const remainingMs = DateTime.toEpochMillis(deadline) - DateTime.toEpochMillis(now);
    const requestMs = Duration.toMillis(ANSWER_SLACK);
    const timeoutMs = Math.min(remainingMs, requestMs);

    if (timeoutMs <= 0) {
      return Option.none();
    }

    const timeout = Duration.millis(timeoutMs);

    return Option.some(timeout);
  });
}
