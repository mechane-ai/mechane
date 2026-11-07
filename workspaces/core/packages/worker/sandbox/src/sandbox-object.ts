import { openSandboxStore, ReservationPhase, sandboxAlarm } from '@mechane/sandbox-store';
import type { SandboxAlarm, SandboxStore } from '@mechane/sandbox-store';
import {
  ExecutionProgress,
  OptionalExecutionEnvironment,
  SandboxAction,
  SandboxExecutionRefusal,
  SandboxExecutionResult,
  SandboxOwner,
  SandboxReport,
  SandboxRequest,
} from '@mechane/sandbox-wire';
import type { ExecutionId, RunExecutionInput } from '@mechane/sandbox-wire';
import { afterSettling, capturePromise, serialCalls } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { DateTime, Duration, Option, Result, Schema } from 'effect';
import { capacityClient } from './capacity/capacity-client.ts';
import { CapacityRefused, machineCapacity } from './capacity/machine-capacity.ts';
import { MAINTENANCE_RETRY, SANDBOX_IDLE, STOP_RETRY } from './constants.ts';
import type { SandboxEnvironment } from './environment.ts';
import { cancelActiveExecutions } from './executions/cancel-active-executions.ts';
import { cancelExecution } from './executions/cancel-execution.ts';
import { claimExecution } from './executions/claim-execution.ts';
import { executionProgress } from './executions/execution-progress.ts';
import { runExecution } from './executions/run-execution.ts';
import { maintenanceActive } from './maintenance/maintenance-active.ts';
import { maintenanceValue } from './maintenance/maintenance-value.ts';
import { managePortable } from './maintenance/manage-portable.ts';
import { machineProvider } from './providers/machine-provider.ts';
import { sandboxSettings } from './providers/sandbox-settings.ts';
import type { MachineIdInput, MachineProvider, WorkspaceFiles } from './types.ts';
import { advanceIdleWorkspace } from './workspace/advance-idle-workspace.ts';

type BindOwnerInput = { readonly owner: typeof SandboxOwner.Encoded };
type ManageInput = { readonly request: typeof SandboxRequest.Encoded };
type ObserveInput = Pick<RunExecutionInput, 'executionId' | 'waitMs'>;
type ResumeInput = ObserveInput & { readonly environment: RunExecutionInput['environment'] };
type CancelInput = { readonly executionId: ExecutionId };
type StopCallInput = { readonly promise: Promise<void> };

/** One authenticated mech's persistent files and command receipts, independent of its agent executor. */
export class SandboxObject extends DurableObject<SandboxEnvironment> {
  readonly #store: SandboxStore;
  readonly #alarm: SandboxAlarm;
  readonly #provider: MachineProvider;
  readonly #capacity: ReturnType<typeof machineCapacity>;
  readonly #providerName: string;
  readonly #workspace: WorkspaceFiles;
  readonly #calls = serialCalls();
  readonly #stops = new Set<Promise<void>>();

  constructor(state: DurableObjectState, environment: SandboxEnvironment) {
    super(state, environment);

    this.#store = openSandboxStore({ storage: state.storage });
    this.#alarm = sandboxAlarm({ storage: state.storage });

    const settings = sandboxSettings({ store: this.#store, environment });
    const provider = machineProvider({ settings: settings.variables, state });

    this.#workspace = { bucket: settings.workspaceBucket, owner: state.id.toString() };
    this.#providerName = settings.variables.provider;
    const client = capacityClient({ settings: settings.runtime });

    this.#capacity = machineCapacity({
      store: this.#store,
      provider,
      client,
      scheduleStopRetry: () => this.#armRetry(),
    });

    this.#provider = this.#capacity.provider;
  }

  async bindOwner({ owner }: BindOwnerInput): Promise<void> {
    const decoded = Schema.decodeUnknownSync(SandboxOwner)(owner);

    await this.#capacity.bindOwner({ owner: decoded });
  }

  async schemaRevision(): Promise<number> {
    return this.#store.schemaRevision();
  }

  async manage({ request: input }: ManageInput): Promise<typeof SandboxReport.Encoded> {
    return await this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);
        this.#capacity.requireOwner();

        const request = Schema.decodeUnknownSync(SandboxRequest)(input);

        if (request.action !== SandboxAction.Show) {
          await this.#armMaintenance();
        }

        const report = await managePortable({
          store: this.#store,
          provider: this.#provider,
          workspace: this.#workspace,
          request,
          providerName: this.#providerName,
        });

        if (request.action !== SandboxAction.Show && !maintenanceActive({ store: this.#store })) {
          await this.#armIdle();
        }

        return Schema.encodeSync(SandboxReport)(report);
      },
    });
  }

  async runExecution({
    executionId,
    command,
    timeoutMs,
    waitMs,
    environment,
  }: RunExecutionInput): Promise<typeof SandboxExecutionResult.Encoded> {
    this.#capacity.requireOwner();

    const input = { executionId, command, timeoutMs, waitMs, environment };
    const timeout = Duration.millis(timeoutMs);
    const request = { executionId, command, timeout };
    const now = DateTime.nowUnsafe();
    const claim = claimExecution({ store: this.#store, request, now });

    if (Result.isFailure(claim)) {
      const refusal = SandboxExecutionRefusal.cases.ExecutionReused.make({});

      return Schema.encodeSync(SandboxExecutionResult)(refusal);
    }

    const progress = executionProgress({ execution: claim.success });

    if (!ExecutionProgress.guards.Running(progress)) {
      return Schema.encodeSync(SandboxExecutionResult)(progress);
    }

    const answer = await this.#calls.run({ run: () => this.#runExecution(input) });

    return Schema.encodeSync(SandboxExecutionResult)(answer);
  }

  async observeExecution({ executionId, waitMs }: ObserveInput): Promise<typeof SandboxExecutionResult.Encoded> {
    return await this.resumeExecution({ executionId, waitMs, environment: null });
  }

  async resumeExecution({
    executionId,
    waitMs,
    environment,
  }: ResumeInput): Promise<typeof SandboxExecutionResult.Encoded> {
    this.#capacity.requireOwner();

    const found = this.#store.execution({ executionId });

    if (Option.isNone(found)) {
      const refusal = SandboxExecutionRefusal.cases.ExecutionNotFound.make({});

      return Schema.encodeSync(SandboxExecutionResult)(refusal);
    }

    const execution = found.value;
    const timeoutMs = Duration.toMillis(execution.timeout);

    return await this.runExecution({ executionId, command: execution.command, timeoutMs, waitMs, environment });
  }

  async #runExecution({
    executionId,
    command,
    timeoutMs,
    waitMs,
    environment,
  }: RunExecutionInput): Promise<SandboxExecutionResult> {
    await Promise.all(this.#stops);

    if (maintenanceActive({ store: this.#store })) {
      return ExecutionProgress.cases.Running.make({});
    }

    await this.#armIdle();

    const timeout = Duration.millis(timeoutMs);
    const wait = Duration.millis(waitMs);
    const decodedEnvironment = Schema.decodeUnknownSync(OptionalExecutionEnvironment)(environment);

    const pending = runExecution({
      store: this.#store,
      provider: this.#provider,
      workspace: this.#workspace,
      request: { executionId, command, timeout, wait },
      environment: decodedEnvironment,
    });

    const attempted = await capturePromise({ promise: pending });

    if (Result.isFailure(attempted) && Schema.is(CapacityRefused)(attempted.failure)) {
      return SandboxExecutionRefusal.cases.CapacityRefused.make({ reason: attempted.failure.reason });
    }

    return Result.getOrThrow(attempted);
  }

  async stop(): Promise<void> {
    await this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);

        const workspace = this.#store.workspace();

        if (Option.isSome(workspace.recovery) || maintenanceActive({ store: this.#store })) {
          return;
        }

        const latest = this.#store.latestMachine();
        const now = DateTime.nowUnsafe();

        if (Option.isSome(latest) && Option.isNone(workspace.checkpoint)) {
          this.#store.loseMachine({ machineId: latest.value.id, now });
        }

        await this.#alarm.arm({ at: now });
      },
    });
  }

  async cancelExecution({ executionId }: CancelInput): Promise<void> {
    const promise = cancelExecution({ store: this.#store, provider: this.#provider, executionId });

    await this.#awaitStop({ promise });
  }

  async cancelActiveExecutions(): Promise<void> {
    const promise = cancelActiveExecutions({ store: this.#store, provider: this.#provider });

    await this.#awaitStop({ promise });
  }

  async #awaitStop({ promise }: StopCallInput): Promise<void> {
    this.#stops.add(promise);

    await afterSettling({
      promise,
      run: () => {
        this.#stops.delete(promise);
      },
    });
  }

  override async alarm(): Promise<void> {
    await this.#calls.run({ run: () => this.#onAlarm() });
  }

  async #onAlarm(): Promise<void> {
    await Promise.all(this.#stops);

    const reservation = this.#capacity.reservation();

    if (Option.isSome(reservation) && reservation.value.phase === ReservationPhase.Stopping) {
      await this.#armRetry();
      await this.#provider.stop({ machineId: reservation.value.machineId });
    }

    if (maintenanceActive({ store: this.#store })) {
      await this.#armMaintenance();

      const maintenance = this.#store.portableMaintenance();
      const job = maintenanceValue({ value: maintenance, field: 'portableMaintenance' });
      const operationId = Option.some(job.id);

      await managePortable({
        store: this.#store,
        provider: this.#provider,
        workspace: this.#workspace,
        request: { action: job.action, operationId },
        providerName: this.#providerName,
      });

      if (!maintenanceActive({ store: this.#store })) {
        await this.#armIdle();
      }

      return;
    }

    const held = this.#capacity.reservation();

    if (Option.isSome(held)) {
      await this.#stopIdleMachine({ machineId: held.value.machineId });

      return;
    }

    const latest = this.#store.latestMachine();

    if (Option.isSome(latest)) {
      await this.#stopIdleMachine({ machineId: latest.value.id });
    }
  }

  async #stopIdleMachine({ machineId }: MachineIdInput): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, STOP_RETRY);

    await this.#alarm.arm({ at });

    const canStop = await advanceIdleWorkspace({
      store: this.#store,
      provider: this.#provider,
      workspace: this.#workspace,
    });

    if (!canStop) {
      return;
    }

    this.#store.loseMachine({ machineId, now });
    await this.#alarm.arm({ at });
    await this.#provider.stop({ machineId });
    await this.#alarm.disarmAt({ at });
  }

  async #armIdle(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, SANDBOX_IDLE);

    await this.#alarm.arm({ at });
  }

  async #armRetry(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, STOP_RETRY);

    await this.#alarm.arm({ at });
  }

  async #armMaintenance(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, MAINTENANCE_RETRY);

    await this.#alarm.arm({ at });
  }
}
