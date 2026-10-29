import {
  boundedText,
  Bytes,
  isBetweenDuration,
  RecordId,
  RecordText,
  renamedWireStruct,
  wireStruct,
} from '@mechane/records';
import { Duration, Schema, SchemaTransformation } from 'effect';
import {
  EXECUTION_ID_PREFIX,
  EXECUTION_MAX_BYTES,
  EXECUTION_TIMEOUT_MAX,
  EXECUTION_WAIT_MAX,
  GUEST_VARIABLES,
  GuestScope,
  HostMachineStatus,
  ReceiptStatus,
} from './constants.ts';

/**
 * The id of an execution: the pi tool task it runs for, so a rerun of the task asks for the execution it already
 * started. Receipts are stored under it, so it is a stored format.
 */
export const ExecutionId = Schema.String.check(
  Schema.isPattern(
    new RegExp(
      `^(?:${EXECUTION_ID_PREFIX}[0-9]{1,16}|source-(?:prepare|finalize|capture)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
    ),
  ),
).pipe(Schema.brand('ExecutionId'));

export type ExecutionId = typeof ExecutionId.Type;

/** A span the guest's wire writes as whole milliseconds. */
const WholeMillis = Schema.Int.pipe(Schema.decodeTo(Schema.Duration, SchemaTransformation.durationFromMillis));

/** How long a request waits for its execution to settle, as a query writes it. */
export const ExecutionWait = renamedWireStruct({
  fields: {
    wait: Schema.NumberFromString.pipe(Schema.decodeTo(WholeMillis)).check(
      isBetweenDuration({ minimum: Duration.zero, maximum: EXECUTION_WAIT_MAX }),
    ),
  },
  renames: { wait: 'wait_ms' },
});

export type ExecutionWait = typeof ExecutionWait.Type;

/**
 * Bash text that a process can start with. A process's argument ends at a NUL character, and the kernel refuses one
 * longer than its limit, so the guest would fail to start bash for either.
 */
const BashText = boundedText({ maxBytes: EXECUTION_MAX_BYTES });

/** Bash text to run once from the machine's home; it and every process it starts end at its timeout. */
export const ExecutionRequest = renamedWireStruct({
  fields: {
    command: BashText,
    timeout: WholeMillis.check(isBetweenDuration({ minimum: Duration.millis(1), maximum: EXECUTION_TIMEOUT_MAX })),
  },
  renames: { timeout: 'timeout_ms' },
});

export type ExecutionRequest = typeof ExecutionRequest.Type;

/** The tail of an execution's combined output, and how many bytes before it the receipt left out. */
const ExecutionOutput = wireStruct({ fields: { text: RecordText, omittedBytes: Bytes } });

const Exited = renamedWireStruct({
  fields: {
    state: Schema.Literal(ReceiptStatus.Exited),
    exitCode: Schema.Int,
    duration: WholeMillis,
    output: ExecutionOutput,
  },
  renames: { duration: 'duration_ms' },
});

const TimedOut = renamedWireStruct({
  fields: { state: Schema.Literal(ReceiptStatus.TimedOut), duration: WholeMillis, output: ExecutionOutput },
  renames: { duration: 'duration_ms' },
});

/** A settled execution's receipt, which never changes but to drop its output's text from an old one. */
export const SettledReceipt = Schema.Union([Exited, TimedOut]);

export type SettledReceipt = typeof SettledReceipt.Type;

/** What the guest answers for an execution: that it still runs, or how it settled. */
export const ExecutionReceipt = Schema.Union([
  Schema.Struct({ state: Schema.Literal(ReceiptStatus.Running) }),
  Exited,
  TimedOut,
]);

export type ExecutionReceipt = typeof ExecutionReceipt.Type;

/** A receipt's output as the RPC carries it: the guest wire's decoded form, since an RPC answer is plain data. */
const SettledOutput = Schema.toType(ExecutionOutput);

/**
 * Where an execution is, as the sandbox's object answers it: still running, settled with its receipt, uncertain or
 * unavailable. An uncertain execution's machine ended without a receipt, so it may have partly run and is never sent
 * again. An unavailable one never ran, since no machine started for it.
 */
export const ExecutionProgress = Schema.TaggedUnion({
  Running: {},
  Exited: { exitCode: Schema.Int, duration: Schema.DurationFromMillis, output: SettledOutput },
  TimedOut: { duration: Schema.DurationFromMillis, output: SettledOutput },
  Uncertain: {},
  Unavailable: {},
  PersistenceFailed: { reason: Schema.String, duration: Schema.DurationFromMillis, output: SettledOutput },
});

export type ExecutionProgress = typeof ExecutionProgress.Type;

/** The one line a guest writes to standard output once it listens, so its starter learns a port the system chose. */
export const GuestListening = Schema.Struct({ port: Schema.Int });

export type GuestListening = typeof GuestListening.Type;

/**
 * The variables a provider starts a guest with: the machine it serves, whose id every request to it must name. The id's
 * random bits are known only to the sandbox's object and the machine, so no other caller can name it.
 */
export const GuestStart = renamedWireStruct({
  fields: { machineId: RecordId, scope: Schema.Enum(GuestScope) },
  renames: { machineId: GUEST_VARIABLES.machineId, scope: GUEST_VARIABLES.scope },
});

export type GuestStart = typeof GuestStart.Type;

/** What the Worker asks the host launcher to start a machine with: the variables a container is started with. */
export const HostMachineStart = Schema.Struct({ environment: GuestStart });

export type HostMachineStart = typeof HostMachineStart.Type;

/** What the host launcher reports for a machine, which it starts once and never again. */
export const HostMachine = Schema.Union([
  Schema.Struct({ state: Schema.Literal(HostMachineStatus.Starting) }),
  Schema.Struct({ state: Schema.Literal(HostMachineStatus.Running), port: Schema.Int }),
  Schema.Struct({ state: Schema.Literal(HostMachineStatus.Exited) }),
]);

export type HostMachine = typeof HostMachine.Type;
