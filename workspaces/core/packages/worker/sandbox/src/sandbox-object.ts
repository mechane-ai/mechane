import { SandboxAction, SandboxPhase, SandboxRequest } from '@mechane/protocol';
import { SourceId } from '@mechane/records';
import type {
  MachineRefusal,
  SandboxBindInput,
  SandboxCancelInput,
  SandboxManageInput,
  SandboxRpc,
  SourceCaptureInput,
  SourceCloneInput,
  SourceIdentityInput,
  SourcePrepareInput,
  WorkerEnvironment,
} from '@mechane/rpc';
import {
  objectBindings,
  SANDBOX_IDLE,
  SandboxAnswer,
  SandboxCaptureAnswer,
  SandboxExecutionAnswer,
  SandboxSourceAnswer,
  STOP_RETRY,
} from '@mechane/rpc';
import { openSandboxStore, ReservationPhase, sandboxAlarm } from '@mechane/sandbox-store';
import type { SandboxAlarm, SandboxStore } from '@mechane/sandbox-store';
import { ExecutionProgress, SandboxOwner, SourceCapture, SourceCheckout, SourceClone } from '@mechane/sandbox-wire';
import type { RunExecutionInput } from '@mechane/sandbox-wire';
import { afterSettling, capturePromise, serialCalls } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { DateTime, Duration, Option, Result, Schema } from 'effect';
import { MachineAccessDenied, machineCapacity } from './capacity/machine-capacity.ts';
import { PortableMaintenanceRefused } from './errors.ts';
import { cancelActiveExecutions } from './executions/cancel-active-executions.ts';
import { cancelExecution } from './executions/cancel-execution.ts';
import { claimExecution } from './executions/claim-execution.ts';
import { executionProgress } from './executions/execution-progress.ts';
import { runExecution } from './executions/run-execution.ts';
import { maintenanceActive } from './maintenance/maintenance-active.ts';
import { manageSandboxWorkspace } from './maintenance/manage-sandbox-workspace.ts';
import { nativeWorkspacePending } from './maintenance/native-workspace-pending.ts';
import { machineProvider } from './providers/machine-provider.ts';
import { sandboxSettings } from './providers/sandbox-settings.ts';
import { captureSource } from './sources/capture-source.ts';
import { cloneSource } from './sources/clone-source.ts';
import { finishSource } from './sources/finish-source.ts';
import { prepareSource } from './sources/prepare-source.ts';
import { revokeSource } from './sources/revoke-source.ts';
import type { MachineIdInput, MachineProvider, WorkspaceFiles, WorkspaceProviderStepInput } from './types.ts';
import { advanceIdleWorkspace } from './workspace/advance-idle-workspace.ts';

/** A source credential lease prevents maintenance from changing the sandbox machine. */
class SandboxFenced extends Schema.TaggedError<SandboxFenced>()('SandboxFenced', { sourceId: SourceId }) {}

type SourceCallInput<Value> = {
  readonly run: (input: WorkspaceProviderStepInput) => Promise<Value>;
  readonly shouldCheckPolicy: boolean;
};

type StopCallInput = { readonly promise: Promise<void> };
const READ_ACTIONS: ReadonlySet<SandboxAction> = new Set([SandboxAction.Show, SandboxAction.Download]);

const MACHINE_ACTIONS: ReadonlySet<SandboxAction> = new Set([
  SandboxAction.Export,
  SandboxAction.Import,
  SandboxAction.Upgrade,
  SandboxAction.Upload,
]);

/**
 * One mech's or one drone's sandbox: the machines its executions run on, one at a time, and every execution's receipt.
 * Only its mech's object calls it, by RPC under the name `sandboxStub` derives and binds as its durable owner. Its
 * store decides synchronously, every intent commits before its effect, and its alarm stops an idle or ended machine.
 */
export class SandboxObject extends DurableObject<unknown> implements SandboxRpc {
  readonly #store: SandboxStore;
  readonly #alarm: SandboxAlarm;
  readonly #provider: MachineProvider;
  readonly #capacity: ReturnType<typeof machineCapacity>;
  readonly #providerName: string;
  readonly #workspace: WorkspaceFiles;
  readonly #calls = serialCalls();
  readonly #stops = new Set<Promise<void>>();

  constructor(state: DurableObjectState, environment: WorkerEnvironment) {
    super(state, environment);

    this.#store = openSandboxStore({ storage: state.storage });
    this.#alarm = sandboxAlarm({ storage: state.storage });

    const settings = sandboxSettings({ store: this.#store, variables: environment });
    const bindings = objectBindings({ environment });
    const owner = state.id.toString();

    this.#workspace = { bucket: bindings.workspaceFiles, owner };
    this.#providerName = settings.provider;

    const provider = machineProvider({ settings, state });

    this.#capacity = machineCapacity({ store: this.#store, bindings, identity: owner, provider });

    this.#provider = this.#capacity.provider;
  }

  async bindOwner({ owner }: SandboxBindInput): Promise<void> {
    const decoded = Schema.decodeUnknownSync(SandboxOwner)(owner);
    const isFirstBinding = await this.#capacity.bindOwner({ owner: decoded });
    const held = this.#capacity.reservation();

    if (isFirstBinding && Option.isSome(held)) {
      await this.#armRetry();
    }
  }

  get #isImportRequired(): boolean {
    return nativeWorkspacePending({ store: this.#store, providerName: this.#providerName });
  }

  async manage({ request: input }: SandboxManageInput): Promise<typeof SandboxAnswer.Encoded> {
    const answer = await machineCall({ run: () => this.#calls.run({ run: () => this.#manage({ request: input }) }) });

    return Schema.encodeSync(SandboxAnswer)(answer);
  }

  async #manage({ request: input }: SandboxManageInput): Promise<SandboxAnswer> {
    await Promise.all(this.#stops);

    const request = Schema.decodeUnknownSync(SandboxRequest)(input);

    this.#assertUnfenced();

    if (MACHINE_ACTIONS.has(request.action)) {
      await this.#capacity.requireEnabled();
    }

    if (!READ_ACTIONS.has(request.action)) {
      await this.#armRetry();
    }

    const report = await manageSandboxWorkspace({
      store: this.#store,
      provider: this.#provider,
      workspace: this.#workspace,
      request,
      providerName: this.#providerName,
    });

    if (request.action !== SandboxAction.Show && report.phase === SandboxPhase.Done) {
      const now = DateTime.nowUnsafe();
      const at = DateTime.addDuration(now, SANDBOX_IDLE);

      await this.#alarm.arm({ at });
    }

    return SandboxAnswer.cases.Found.make({ report });
  }

  async schemaRevision(): Promise<number> {
    return this.#store.schemaRevision();
  }

  /**
   * Runs the execution once under its id, waiting at most its wait for it to settle; while it answers Running, the
   * caller asks again with the same input. A repeated id answers from the execution's receipt. Every call first moves
   * the idle stop an idle window past it, so a machine stops only after a window in which no command reached it.
   */
  async runExecution({
    executionId,
    command,
    timeoutMs,
    waitMs,
  }: RunExecutionInput): Promise<typeof SandboxExecutionAnswer.Encoded> {
    const timeout = Duration.millis(timeoutMs);
    const now = DateTime.nowUnsafe();
    const claim = claimExecution({ store: this.#store, request: { executionId, command, timeout }, now });

    const execution = Result.getOrThrow(claim);
    const progress = executionProgress({ execution });

    if (!ExecutionProgress.guards.Running(progress)) {
      return Schema.encodeSync(SandboxExecutionAnswer)(progress);
    }

    const answer = await machineCall({
      run: () => this.#calls.run({ run: () => this.#runExecution({ executionId, command, timeoutMs, waitMs }) }),
    });

    return Schema.encodeSync(SandboxExecutionAnswer)(answer);
  }

  async #runExecution({ executionId, command, timeoutMs, waitMs }: RunExecutionInput): Promise<ExecutionProgress> {
    await Promise.all(this.#stops);
    await this.#capacity.requireEnabled();

    const fence = this.#store.activeSourceFence();

    if (Option.isSome(fence) || maintenanceActive({ store: this.#store }) || this.#isImportRequired) {
      const pending = ExecutionProgress.cases.Running.make({});

      return pending;
    }

    const now = DateTime.nowUnsafe();

    const at = DateTime.addDuration(now, SANDBOX_IDLE);

    await this.#alarm.arm({ at });

    const timeout = Duration.millis(timeoutMs);
    const wait = Duration.millis(waitMs);

    const progress = await runExecution({
      store: this.#store,
      provider: this.#provider,
      workspace: this.#workspace,
      request: { executionId, command, timeout, wait },
    });

    return progress;
  }

  /** Ends the current machine identity and arms its stop, retaining persistent workspace files. */
  async stop(): Promise<void> {
    return await this.#calls.run({ run: () => this.#stop() });
  }

  async cancelExecution({ executionId }: SandboxCancelInput): Promise<void> {
    const promise = cancelExecution({ store: this.#store, provider: this.#provider, executionId });

    return await this.#awaitStop({ promise });
  }

  async cancelActiveExecutions(): Promise<void> {
    const promise = cancelActiveExecutions({ store: this.#store, provider: this.#provider });

    return await this.#awaitStop({ promise });
  }

  async #awaitStop({ promise }: StopCallInput): Promise<void> {
    this.#stops.add(promise);

    const release: () => void = () => {
      this.#stops.delete(promise);
    };

    return await afterSettling({ promise, run: release });
  }

  async #stop(): Promise<void> {
    await Promise.all(this.#stops);
    this.#assertUnfenced();

    const workspace = this.#store.workspace();

    if (Option.isSome(workspace.recovery) || maintenanceActive({ store: this.#store }) || this.#isImportRequired) {
      return;
    }

    const latest = this.#store.latestMachine();
    const now = DateTime.nowUnsafe();

    if (Option.isSome(latest) && Option.isNone(workspace.checkpoint)) {
      this.#store.loseMachine({ machineId: latest.value.id, now });
    }

    await this.#alarm.arm({ at: now });
  }

  /**
   * Stops the machine opened last, which no call asked about for an idle window, or whose owner asked it to stop. Its
   * end is recorded before its stop, so a later call starts a new machine, and an execution it held without a receipt
   * becomes uncertain. A retry armed before the stop and cleared after it outlasts the platform's own alarm retries.
   */
  override async alarm(): Promise<void> {
    return await this.#calls.run({ run: () => this.#onAlarm() });
  }

  async #onAlarm(): Promise<void> {
    await Promise.all(this.#stops);

    const reservation = this.#capacity.reservation();

    if (Option.isSome(reservation) && reservation.value.phase === ReservationPhase.Stopping) {
      await this.#armRetry();
      await this.#provider.stop({ machineId: reservation.value.machineId });
    }

    const fence = this.#store.activeSourceFence();

    if (Option.isSome(fence)) {
      const now = DateTime.nowUnsafe();
      const at = DateTime.addDuration(now, STOP_RETRY);

      await this.#alarm.arm({ at });
      await finishSource({
        store: this.#store,
        provider: this.#provider,
        workspace: this.#workspace,
        sourceId: fence.value.sourceId,
        generation: fence.value.generation,
      });

      return;
    }

    if (maintenanceActive({ store: this.#store }) || this.#isImportRequired) {
      return;
    }

    const latest = this.#store.latestMachine();
    const held = this.#capacity.reservation();

    if (Option.isSome(held)) {
      await this.#stopIdleMachine({ machineId: held.value.machineId });

      return;
    }

    if (Option.isNone(latest)) {
      return;
    }

    await this.#stopIdleMachine({ machineId: latest.value.id });
  }

  async #stopIdleMachine({ machineId }: MachineIdInput): Promise<void> {
    const now = DateTime.nowUnsafe();
    const retryAt = DateTime.addDuration(now, STOP_RETRY);

    await this.#alarm.arm({ at: retryAt });

    const canStop = await advanceIdleWorkspace({
      store: this.#store,
      provider: this.#provider,
      workspace: this.#workspace,
    });

    if (!canStop) {
      return;
    }

    this.#store.loseMachine({ machineId, now });
    await this.#alarm.arm({ at: retryAt });
    await this.#provider.stop({ machineId });
    await this.#alarm.disarmAt({ at: retryAt });
  }

  #assertUnfenced(): void {
    const fence = this.#store.activeSourceFence();

    if (Option.isNone(fence)) {
      return;
    }

    const cause = new SandboxFenced({ sourceId: fence.value.sourceId });
    const failure = Result.fail(cause);

    Result.getOrThrow(failure);
  }

  async #sourceCall<Value>({ run, shouldCheckPolicy }: SourceCallInput<Value>): Promise<Value | MachineRefusal> {
    const call: () => Promise<Value> = async () => {
      await Promise.all(this.#stops);

      if (shouldCheckPolicy) {
        await this.#capacity.requireEnabled();
      }

      if (maintenanceActive({ store: this.#store }) || this.#isImportRequired) {
        const cause = new PortableMaintenanceRefused({ reason: 'finish sandbox maintenance before source work' });
        const failure = Result.fail(cause);

        return Result.getOrThrow(failure);
      }

      const now = DateTime.nowUnsafe();
      const at = DateTime.addDuration(now, STOP_RETRY);

      await this.#alarm.arm({ at });

      return await run({ store: this.#store, provider: this.#provider, workspace: this.#workspace });
    };

    return await machineCall({ run: () => this.#calls.run({ run: call }) });
  }

  async prepareSource({ checkout }: SourcePrepareInput): Promise<typeof SandboxSourceAnswer.Encoded> {
    const decoded = Schema.decodeUnknownSync(SourceCheckout)(checkout);

    const report = await this.#sourceCall({
      shouldCheckPolicy: true,
      run: (input) => prepareSource({ ...input, checkout: decoded }),
    });

    return Schema.encodeSync(SandboxSourceAnswer)(report);
  }

  async cloneSource({ clone }: SourceCloneInput): Promise<typeof SandboxSourceAnswer.Encoded> {
    const decoded = Schema.decodeUnknownSync(SourceClone)(clone);

    const report = await this.#sourceCall({
      shouldCheckPolicy: true,
      run: (input) => cloneSource({ ...input, clone: decoded }),
    });

    return Schema.encodeSync(SandboxSourceAnswer)(report);
  }

  async revokeSource({ sourceId, generation }: SourceIdentityInput): Promise<typeof SandboxSourceAnswer.Encoded> {
    const report = await this.#sourceCall({
      shouldCheckPolicy: false,
      run: (input) => revokeSource({ ...input, sourceId, generation }),
    });

    return Schema.encodeSync(SandboxSourceAnswer)(report);
  }

  async finishSource({ sourceId, generation }: SourceIdentityInput): Promise<typeof SandboxSourceAnswer.Encoded> {
    const report = await this.#sourceCall({
      shouldCheckPolicy: false,
      run: (input) => finishSource({ ...input, sourceId, generation }),
    });

    return Schema.encodeSync(SandboxSourceAnswer)(report);
  }

  async captureSource({ capture }: SourceCaptureInput): Promise<typeof SandboxCaptureAnswer.Encoded> {
    const decoded = Schema.decodeUnknownSync(SourceCapture)(capture);

    const report = await this.#sourceCall({
      shouldCheckPolicy: true,
      run: (input) => captureSource({ ...input, capture: decoded }),
    });

    return Schema.encodeSync(SandboxCaptureAnswer)(report);
  }

  async #armRetry(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, STOP_RETRY);

    await this.#alarm.arm({ at });
  }
}

type MachineCallInput<Value> = { readonly run: () => Promise<Value> };

/** Expected admission failures cross RPC as data; transport failures and broken invariants still reject. */
async function machineCall<Value>({ run }: MachineCallInput<Value>): Promise<Value | MachineRefusal> {
  const promise = run();
  const result = await capturePromise({ promise });

  if (Result.isFailure(result) && Schema.is(MachineAccessDenied)(result.failure)) {
    return result.failure.refusal;
  }

  return Result.getOrThrow(result);
}
