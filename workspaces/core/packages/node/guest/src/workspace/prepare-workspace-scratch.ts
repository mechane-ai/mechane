import { BYTES_PER_KIBIBYTE, MachineId, SHA256_PATTERN } from '@mechane/records';
import { Duration, Effect, Option, Result, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { GuestMisconfigured } from '../errors.ts';
import type { GuestSettings } from '../types.ts';
import { prepareHomeCache } from './prepare-home-cache.ts';
import { WORKSPACE_SCRATCH_PREFIX } from './workspace-scratch-path.ts';

const OWNER_FILE = '.mechane-guest.json';
const SCRATCH_OWNER = 'mechane-guest';
const ABSENT_PROCESS_CODE = 'ESRCH';
const MARKER_MAX_BYTES = BYTES_PER_KIBIBYTE;
const CLEANUP_TIMEOUT = Duration.seconds(15);

const CLEANUP_BOUND = Effect.timeoutOrElse({
  duration: CLEANUP_TIMEOUT,
  orElse: () => new GuestMisconfigured({ reason: 'retired guest scratch cleanup exceeded its deadline' }),
});

const MarkerDigest = Schema.isPattern(SHA256_PATTERN);
const PositiveProcessId = Schema.isGreaterThanOrEqualTo(1);

const ScratchOwner = Schema.Struct({
  owner: Schema.Literal(SCRATCH_OWNER),
  homeKey: Schema.String.check(MarkerDigest),
  machineId: MachineId,
  processId: Schema.Int.check(PositiveProcessId),
});

const OwnerJson = Schema.fromJsonString(ScratchOwner);
const AbsentProcess = Schema.Struct({ code: Schema.Literal(ABSENT_PROCESS_CODE) });

type ScratchInput = Pick<GuestSettings, 'home' | 'machineId' | 'scratchDirectory' | 'scope'>;
type PreviousInput = { readonly folder: string; readonly homeKey: string };
type RemoveScratchInput = PreviousInput & Pick<ScratchInput, 'scratchDirectory'>;

class ScratchOwnerUnreadable extends Schema.TaggedError<ScratchOwnerUnreadable>()('ScratchOwnerUnreadable', {
  reason: Schema.String,
}) {}

/** Native filesystem snapshots retain scratch directories but never the processes that owned them. */
export const prepareWorkspaceScratch = Effect.fn('prepareWorkspaceScratch')(function* ({
  home,
  machineId,
  scratchDirectory,
  scope,
}: ScratchInput): Effect.fn.Return<void, GuestMisconfigured> {
  yield* prepareHomeCache({ home, scope });

  const homeKey = createHash('sha256').update(home).digest('hex');
  const metadata = Schema.encodeSync(OwnerJson)({ owner: SCRATCH_OWNER, homeKey, machineId, processId: process.pid });
  const marker = join(scratchDirectory, OWNER_FILE);

  yield* Effect.tryPromise({
    try: () => writeFile(marker, metadata, { flag: 'wx' }),
    catch: () => new GuestMisconfigured({ reason: 'record guest scratch ownership failed' }),
  });

  const temporary = dirname(scratchDirectory);

  const entries = yield* Effect.tryPromise({
    try: () => readdir(temporary, { withFileTypes: true }),
    catch: () => new GuestMisconfigured({ reason: 'inspect previous guest scratch failed' }),
  });

  const candidates = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith(WORKSPACE_SCRATCH_PREFIX));

  for (const entry of candidates) {
    const folder = join(temporary, entry.name);

    yield* removeRetiredScratch({ folder, scratchDirectory, homeKey });
  }
}, CLEANUP_BOUND);

const removeRetiredScratch = Effect.fn('removeRetiredScratch')(function* ({
  folder,
  scratchDirectory,
  homeKey,
}: RemoveScratchInput): Effect.fn.Return<void, GuestMisconfigured> {
  if (folder === scratchDirectory) {
    return;
  }

  const owner = yield* readScratchOwner({ folder, homeKey }).pipe(
    Effect.catchTags({ ScratchOwnerUnreadable: () => Effect.succeedNone }),
  );

  if (Option.isNone(owner) || !hasExited(owner.value)) {
    return;
  }

  yield* Effect.tryPromise({
    try: () => rm(folder, { recursive: true, force: true }),
    catch: () => new GuestMisconfigured({ reason: 'remove retired guest scratch failed' }),
  });
});

const readScratchOwner = Effect.fn('readScratchOwner')(function* ({
  folder,
  homeKey,
}: PreviousInput): Effect.fn.Return<Option.Option<typeof ScratchOwner.Type>, ScratchOwnerUnreadable> {
  const marker = join(folder, OWNER_FILE);

  const details = yield* Effect.tryPromise({
    try: () => lstat(marker),
    catch: (cause) => new ScratchOwnerUnreadable({ reason: String(cause) }),
  });

  if (!details.isFile() || details.size > MARKER_MAX_BYTES) {
    return Option.none();
  }

  const text = yield* Effect.tryPromise({
    try: () => readFile(marker, 'utf8'),
    catch: (cause) => new ScratchOwnerUnreadable({ reason: String(cause) }),
  });

  const decoded = Schema.decodeUnknownResult(OwnerJson)(text);

  if (Result.isFailure(decoded) || decoded.success.homeKey !== homeKey) {
    return Option.none();
  }

  return Option.some(decoded.success);
});

function hasExited({ processId }: typeof ScratchOwner.Type): boolean {
  // The container reuses its guest PID after restoring files into a new process.
  if (processId === process.pid) {
    return true;
  }

  const observed = Result.try(() => process.kill(processId, 0));

  if (Result.isSuccess(observed)) {
    return false;
  }

  const absent = Schema.decodeUnknownResult(AbsentProcess)(observed.failure);

  return Result.isSuccess(absent);
}
