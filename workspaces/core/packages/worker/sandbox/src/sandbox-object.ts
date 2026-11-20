import {
  BrowserEvidenceProgress,
  EvidenceArtifact,
  EvidencePage,
  EvidenceQuery,
  RequestInvalid,
} from '@mechane/protocol';
import { EvidenceArtifactId, MachineId, SandboxOperationId } from '@mechane/records';
import type { BrowserCall, SandboxAlarm, SandboxStore } from '@mechane/sandbox-store';
import {
  BackgroundWork,
  BrowserRequestReused,
  FileCheckpointIdentityReused,
  FileCheckpointPurpose,
  MachineStatus,
  openSandboxStore,
  ProcessIdentityReused,
  ReservationPhase,
  sandboxAlarm,
} from '@mechane/sandbox-store';
import {
  BrowserArtifactPartRequest,
  BrowserProgress,
  BrowserRequestId,
  EvidenceExportResult,
  ExecutionProgress,
  InstalledActionOrigin,
  InstalledCompletionCursor,
  InstalledCompletionObservation,
  InstalledCompletionPage,
  OptionalExecutionEnvironment,
  ProcessHandle,
  ProcessId,
  ProcessObservation,
  ProcessPending,
  ProcessSummaries,
  SandboxAction,
  SandboxBrowserAbandonResult,
  SandboxBrowserArtifactAnswer,
  SandboxBrowserSubmission,
  SandboxCheckpointObservation,
  SandboxCheckpointResult,
  SandboxCompletionReceipt,
  SandboxExecutionRefusal,
  SandboxExecutionResult,
  SandboxOwner,
  SandboxPhase,
  SandboxProcessAnswer,
  SandboxProcessSubmission,
  SandboxRecoveryAction,
  SandboxRecoveryCheckpointRefusal,
  SandboxRecoveryCheckpointRefusalReason,
  SandboxRecoveryCheckpointRequest,
  SandboxRecoveryCheckpointResult,
  SandboxReport,
  SandboxRequest,
  SandboxRestoreRequest,
  SandboxRestoreResult,
  SandboxRunId,
  SandboxStopObservation,
  SandboxStopOrigin,
  SandboxStopPhase,
  SandboxStopReceipt,
  StartupFailure,
} from '@mechane/sandbox-wire';
import type {
  ExecutionId,
  InstalledProcessCompletion,
  ManagedWorkerClaimWire,
  RunExecutionInput,
} from '@mechane/sandbox-wire';
import { afterSettling, capturePromise } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { DateTime, Duration, Option, Result, Schema } from 'effect';
import { browserProgress } from './browser/browser-progress.ts';
import { observeBrowser } from './browser/observe-browser.ts';
import { readBrowserArtifact } from './browser/read-browser-artifact.ts';
import { runBrowser } from './browser/run-browser.ts';
import { capacityClient } from './capacity/capacity-client.ts';
import { CapacityRefused, machineCapacity } from './capacity/machine-capacity.ts';
import { advanceCheckpoint } from './checkpoints/advance-checkpoint.ts';
import { prepareAutomaticCheckpoint } from './checkpoints/automatic-checkpoint.ts';
import { runFileCheckpoint } from './checkpoints/run-file-checkpoint.ts';
import { resumeRecoveryCheckpoint } from './checkpoints/run-recovery-checkpoint.ts';
import { deliverCompletions } from './completions/deliver-completions.ts';
import { observeBackgroundWork } from './completions/observe-background-work.ts';
import {
  AUTOMATIC_CHECKPOINT_QUIET,
  BACKGROUND_OBSERVE_INTERVAL,
  MAINTENANCE_RETRY,
  RECOVERY_OBSERVE_INTERVAL,
  SANDBOX_IDLE,
  STOP_RETRY,
} from './constants.ts';
import type { SandboxEnvironment, SandboxRuntimeSettings } from './environment.ts';
import { RecoveryCheckpointRefused } from './errors.ts';
import { runBrowserWithEvidence } from './evidence/browser-evidence.ts';
import { encodeBrowserReceipt, encodeEvidencePage, encodeEvidenceReceipt } from './evidence/browser-origin.ts';
import type { ArtifactPage, ArtifactReceipt, BrowserReceipt } from './evidence/browser-origin.ts';
import { cleanupReadyEvidence } from './evidence/evidence-cleanup.ts';
import { exportEvidence } from './evidence/export-evidence.ts';
import { listEvidenceArtifacts, readEvidenceArtifact } from './evidence/read-evidence.ts';
import { cancelActiveExecutions } from './executions/cancel-active-executions.ts';
import { cancelExecution, cancelPendingExecution } from './executions/cancel-execution.ts';
import { claimExecution } from './executions/claim-execution.ts';
import { executionProgress } from './executions/execution-progress.ts';
import { runExecution } from './executions/run-execution.ts';
import { environmentReport } from './inspection/environment-report.ts';
import { storedProcessSummaries } from './inspection/stored-process-summaries.ts';
import { maintenanceActive } from './maintenance/maintenance-active.ts';
import { maintenanceValue } from './maintenance/maintenance-value.ts';
import { managePortable } from './maintenance/manage-portable.ts';
import { restoreWorkspace } from './maintenance/restore-workspace.ts';
import { writeBackgroundObservationFailure } from './output/write-sandbox-diagnostic.ts';
import { claimProcess } from './processes/claim-process.ts';
import { listManagedProcesses } from './processes/list-managed-processes.ts';
import { observeManagedProcess, startManagedProcess } from './processes/managed-processes.ts';
import { machineProvider } from './providers/machine-provider.ts';
import { sandboxSettings } from './providers/sandbox-settings.ts';
import { sandboxCalls } from './sandbox-calls.ts';
import { createManagedMachineController, ManagedAllocationInactive } from './service/managed-machine-controller.ts';
import { serveEvidenceContent } from './service/serve-evidence-content.ts';
import type { MachineIdInput, MachineProvider, WorkspaceFiles } from './types.ts';
import { advanceSandboxStop, failSandboxStop } from './workspace/advance-sandbox-stop.ts';
import { backfillSandboxStop } from './workspace/backfill-sandbox-stop.ts';
import { installedActionOriginMatches } from './workspace/installed-session-identity.ts';
import {
  destroyInstalledWorkspace,
  observeInstalledWorkspace,
  releaseInstalledWorkspace,
  startInstalledWorkspace,
  touchInstalledWorkspace,
} from './workspace/installed-session-workspace.ts';
import { releaseWorkspaceGeneration } from './workspace/release-workspace.ts';
import { requestSandboxStop } from './workspace/request-sandbox-stop.ts';
import { recordFailedDrain, resumeIdleWorkspace } from './workspace/resume-idle-workspace.ts';
import { retireWorkspace } from './workspace/retire-workspace.ts';

type OwnerMode = { readonly isInstalled: boolean };
type ManagedGeneration = { readonly generation: number };
type ScopedInput = Partial<ManagedGeneration>;
type ScopedCall<T> = { readonly generation: ScopedInput['generation']; readonly run: () => Promise<T> };
type ManagedStartInput = ManagedGeneration & { readonly claim: ManagedWorkerClaimWire };

type ProcessSubmissionInput = typeof SandboxProcessSubmission.Encoded &
  ScopedInput &
  Partial<Pick<typeof InstalledProcessCompletion.Encoded, 'origin'>>;

type BindOwnerInput = { readonly owner: typeof SandboxOwner.Encoded };
type ManageInput = { readonly request: typeof SandboxRequest.Encoded };
type RestoreInput = { readonly request: typeof SandboxRestoreRequest.Encoded };
type CheckpointInput = { readonly operationId: SandboxOperationId };
type RecoveryCheckpointInput = CheckpointInput & { readonly request: typeof SandboxRecoveryCheckpointRequest.Encoded };
type ObserveInput = Pick<RunExecutionInput, 'executionId' | 'waitMs'>;
type ResumeInput = ObserveInput & { readonly environment: RunExecutionInput['environment'] };
type CancelInput = { readonly executionId: ExecutionId };
type AcknowledgeCompletionInput = { readonly input: typeof SandboxCompletionReceipt.Encoded };
type StopCallInput = { readonly promise: Promise<void> };

type ProcessIdentityInput = { readonly processId: ProcessId };
type ProcessHandleInput = { readonly handle: typeof ProcessHandle.Encoded };
type ProcessReadInput = ProcessHandleInput & ProcessActivityInput;
type ProcessActivityInput = { readonly shouldTouch: boolean };
type InteractiveCancelInput = { readonly runId: SandboxRunId };
type BrowserIdentityInput = { readonly requestId: BrowserRequestId };

type InstalledBrowserSubmission = typeof SandboxBrowserSubmission.Encoded &
  ManagedGeneration & { readonly origin: typeof InstalledActionOrigin.Encoded };

type BrowserClaim = Parameters<SandboxStore['claimBrowserCall']>[0];

type BrowserEvidenceInput = { readonly call: BrowserCall; readonly shouldDispatch: boolean };

type BrowserArtifactInput = {
  readonly machineId: MachineId;
  readonly request: typeof BrowserArtifactPartRequest.Encoded;
};

type EvidenceIdentityInput = { readonly artifactId: EvidenceArtifactId };

type ProcessStartResultInput = { readonly result: Result.Result<SandboxProcessAnswer, unknown> };

const SETTLED_STOP_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Completed,
  SandboxStopPhase.Canceled,
]);

function processStartResult({ result }: ProcessStartResultInput): SandboxProcessAnswer {
  if (Result.isFailure(result)) {
    if (Schema.is(ProcessIdentityReused)(result.failure)) {
      return SandboxExecutionRefusal.cases.ExecutionReused.make({});
    }

    const refusal = Schema.decodeUnknownResult(CapacityRefused)(result.failure);

    if (Result.isSuccess(refusal)) {
      return SandboxExecutionRefusal.cases.CapacityRefused.make({ reason: refusal.success.reason });
    }
  }

  return Result.getOrThrow(result);
}

/** One authenticated mech's persistent files and command receipts, independent of its agent executor. */
export class SandboxObject extends DurableObject<SandboxEnvironment> {
  readonly #store: SandboxStore;
  readonly #alarm: SandboxAlarm;
  readonly #provider: MachineProvider;
  readonly #capacity: ReturnType<typeof machineCapacity>;
  readonly #providerName: string;
  readonly #managed: ReturnType<typeof createManagedMachineController>;
  readonly #workspace: WorkspaceFiles;
  readonly #runtimeSettings: SandboxRuntimeSettings;
  readonly #calls = sandboxCalls();
  readonly #stops = new Set<Promise<void>>();
  readonly #files = { pending: Option.none<Promise<void>>() };

  constructor(state: DurableObjectState, environment: SandboxEnvironment) {
    super(state, environment);

    this.#store = openSandboxStore({ storage: state.storage });
    this.#alarm = sandboxAlarm({ storage: state.storage });

    const settings = sandboxSettings({ store: this.#store, environment });

    const provider = machineProvider({
      settings: settings.variables,
      state,
      environment,
      onStartupExit: ({ machineId }) => {
        const machine = this.#store.liveMachine();

        if (Option.exists(machine, (value) => value.id === machineId && value.status === MachineStatus.Starting)) {
          const now = DateTime.nowUnsafe();

          this.#store.failStartup({ machineId, failure: StartupFailure.GuestLost, now });
        }
      },
    });

    this.#workspace = { bucket: settings.workspaceBucket, owner: state.id.toString() };
    this.#providerName = settings.variables.provider;
    this.#runtimeSettings = settings.runtime;
    const client = capacityClient({ settings: settings.runtime });

    const admission = { isActive: false };

    this.#capacity = machineCapacity({
      store: this.#store,
      provider,
      client,
      scheduleStopRetry: () => this.#armRetry(),
      isAdmittingInstalled: () => admission.isActive,
    });

    this.#provider = this.#capacity.provider;
    const resources = { store: this.#store, provider: this.#provider, workspace: this.#workspace };

    this.#managed = createManagedMachineController({
      storage: state.storage,
      observed: (claim) => this.#calls.run({ run: () => observeInstalledWorkspace({ ...resources, claim }) }),
      start: (claim, beforeHandoff) =>
        this.#calls.run({
          run: async () => {
            this.#requireOwnerMode({ isInstalled: true });

            admission.isActive = true;
            const promise = startInstalledWorkspace({ ...resources, claim, beforeHandoff });

            return await afterSettling({
              promise,
              run: () => {
                admission.isActive = false;
              },
            });
          },
        }),
      touch: () => this.#calls.run({ run: () => touchInstalledWorkspace(resources) }),
      release: () =>
        this.#calls.run({
          run: async () => {
            const released = await releaseInstalledWorkspace(resources);

            if (!released) {
              await this.#armBackground();
            }

            return released;
          },
        }),
      destroy: () =>
        this.#calls.run({
          run: async () => {
            if (Option.isSome(this.#files.pending)) {
              await this.#files.pending.value;
            }

            const owner = this.#owner();

            return await destroyInstalledWorkspace({ ...resources, owner });
          },
        }),
    });

    void state.blockConcurrencyWhile(async () => {
      if (this.#capacity.isInstalled()) {
        return;
      }

      const machine = this.#store.liveMachine();
      const idleAt = this.#store.sandboxIdleAt();
      const hadMachine = Option.isSome(machine);
      const hadDeadline = Option.isSome(idleAt);

      if (hadMachine && !hadDeadline) {
        const previousDeadline = await this.#alarm.scheduledAt();

        if (Option.isSome(previousDeadline)) {
          this.#store.setSandboxIdleAt({ at: previousDeadline.value });
        }
      }
    });
  }

  async bindManagedOwner({ owner }: BindOwnerInput): Promise<void> {
    const decoded = Schema.decodeUnknownSync(SandboxOwner)(owner);

    await this.#capacity.bindOwner({ owner: decoded, isInstalled: true });
  }

  #requireOwnerMode({ isInstalled }: OwnerMode): void {
    if (this.#capacity.isInstalled() === isInstalled) {
      return;
    }

    const cause = new ManagedAllocationInactive();
    const failure = Result.fail(cause);

    Result.getOrThrow(failure);
  }

  async managedStart({ generation, claim }: ManagedStartInput): Promise<number> {
    this.#requireOwnerMode({ isInstalled: true });

    return await this.#managed.start({ generation, claim });
  }

  async managedTouch({ generation }: ManagedGeneration): Promise<number> {
    this.#requireOwnerMode({ isInstalled: true });

    return await this.#managed.touch({ generation });
  }

  async managedRelease({ generation }: ManagedGeneration): Promise<number> {
    this.#requireOwnerMode({ isInstalled: true });

    return await this.#managed.release({ generation });
  }

  async managedDestroy(): Promise<number> {
    this.#requireOwnerMode({ isInstalled: true });

    return await this.#managed.destroy();
  }

  async #runScoped<T>({ generation, run }: ScopedCall<T>): Promise<T> {
    const value = Option.fromUndefinedOr(generation);

    if (Option.isNone(value)) {
      this.#requireOwnerMode({ isInstalled: false });

      return await this.#calls.run({ run });
    }

    this.#requireOwnerMode({ isInstalled: true });

    return await this.#managed.withActive({ generation: value.value, run: () => this.#calls.run({ run }) });
  }

  async bindOwner({ owner }: BindOwnerInput): Promise<void> {
    const decoded = Schema.decodeUnknownSync(SandboxOwner)(owner);

    await this.#capacity.bindOwner({ owner: decoded, isInstalled: false });
  }

  async schemaRevision(): Promise<number> {
    return this.#store.schemaRevision();
  }

  async completionReceipt({ executionId }: CancelInput): Promise<typeof SandboxCompletionReceipt.Encoded | null> {
    this.#capacity.requireOwner();

    const stored = this.#store.completionReceipt({ executionId });
    const encode = Schema.encodeSync(SandboxCompletionReceipt);

    return Option.match(stored, { onNone: () => null, onSome: encode });
  }

  installedCompletion({ processId }: ProcessIdentityInput): typeof InstalledCompletionObservation.Encoded {
    this.#requireOwnerMode({ isInstalled: true });

    const id = Schema.decodeUnknownSync(ProcessId)(processId);
    const stored = this.#store.installedCompletion({ processId: id });

    return Schema.encodeSync(InstalledCompletionObservation)(stored);
  }

  installedCompletions({ after }: typeof InstalledCompletionCursor.Encoded): typeof InstalledCompletionPage.Encoded {
    this.#requireOwnerMode({ isInstalled: true });

    const cursor = Schema.decodeUnknownSync(InstalledCompletionCursor)({ after });
    const page = this.#store.installedCompletions(cursor);

    return Schema.encodeSync(InstalledCompletionPage)(page);
  }

  async retainedCompletions(): Promise<ReadonlyArray<typeof SandboxCompletionReceipt.Encoded>> {
    this.#capacity.requireOwner();

    return this.#store.retainedCompletions().map((receipt) => Schema.encodeSync(SandboxCompletionReceipt)(receipt));
  }

  async acknowledgeCompletion({ input }: AcknowledgeCompletionInput): Promise<boolean> {
    this.#capacity.requireOwner();

    const receipt = Schema.decodeUnknownSync(SandboxCompletionReceipt)(input);
    const retained = this.#store.completionReceipt({ executionId: receipt.executionId });
    const encode = Schema.encodeSync(SandboxCompletionReceipt);

    if (Option.isNone(retained)) {
      return false;
    }

    const expected = encode(retained.value);
    const actual = encode(receipt);

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      return false;
    }

    this.#store.completeDelivery(receipt);

    return true;
  }

  async checkpoint({ operationId }: CheckpointInput): Promise<typeof SandboxCheckpointResult.Encoded> {
    this.#requireOwnerMode({ isInstalled: false });

    const decoded = Schema.decodeUnknownSync(SandboxOperationId)(operationId);

    const result = await this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);
        this.#capacity.requireOwner();

        const purpose = FileCheckpointPurpose.cases.Activation.make({ operationId: decoded });

        return await runFileCheckpoint({
          store: this.#store,
          provider: this.#provider,
          workspace: this.#workspace,
          purpose,
        });
      },
    });

    await this.#armBackground();

    return Schema.encodeSync(SandboxCheckpointResult)(result);
  }

  async managedRepairCheckpoint({
    generation,
    operationId,
    request,
  }: ManagedGeneration & RecoveryCheckpointInput): Promise<typeof SandboxRecoveryCheckpointResult.Encoded> {
    this.#requireOwnerMode({ isInstalled: true });

    const pending = this.#managed.withRelease({
      generation,
      run: () => this.#retryCheckpoint({ operationId, request }),
    });

    const result = await capturePromise({ promise: pending });

    if (Result.isFailure(result) && Schema.is(ManagedAllocationInactive)(result.failure)) {
      const reason = SandboxRecoveryCheckpointRefusalReason.WorkActive;
      const refusal = SandboxRecoveryCheckpointRefusal.cases.RecoveryCheckpointRefused.make({ reason });

      return Schema.encodeSync(SandboxRecoveryCheckpointResult)(refusal);
    }

    return Result.getOrThrow(result);
  }

  async retryCheckpoint({
    operationId,
    request,
  }: RecoveryCheckpointInput): Promise<typeof SandboxRecoveryCheckpointResult.Encoded> {
    this.#requireOwnerMode({ isInstalled: false });

    return await this.#retryCheckpoint({ operationId, request });
  }

  async #retryCheckpoint({
    operationId,
    request,
  }: RecoveryCheckpointInput): Promise<typeof SandboxRecoveryCheckpointResult.Encoded> {
    const decodedId = Schema.decodeUnknownSync(SandboxOperationId)(operationId);
    const decoded = Schema.decodeUnknownSync(SandboxRecoveryCheckpointRequest)(request);
    const purpose = FileCheckpointPurpose.cases.Recovery.make({ operationId: decodedId, ...decoded });

    const promise = this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);
        this.#capacity.requireOwner();

        return await runFileCheckpoint({
          store: this.#store,
          provider: this.#provider,
          workspace: this.#workspace,
          purpose,
        });
      },
    });

    const result = await capturePromise({ promise });

    await this.#armBackground();

    if (Result.isFailure(result)) {
      const cause = result.failure;

      if (Schema.is(FileCheckpointIdentityReused)(cause)) {
        const reason = SandboxRecoveryCheckpointRefusalReason.OperationReused;
        const refusal = SandboxRecoveryCheckpointRefusal.cases.RecoveryCheckpointRefused.make({ reason });

        return Schema.encodeSync(SandboxRecoveryCheckpointResult)(refusal);
      }

      if (Schema.is(RecoveryCheckpointRefused)(cause)) {
        const refusal = SandboxRecoveryCheckpointRefusal.cases.RecoveryCheckpointRefused.make({ reason: cause.reason });

        return Schema.encodeSync(SandboxRecoveryCheckpointResult)(refusal);
      }
    }

    const answer = Result.getOrThrow(result);

    return Schema.encodeSync(SandboxRecoveryCheckpointResult)(answer);
  }

  async manage({ request: input }: ManageInput): Promise<typeof SandboxReport.Encoded> {
    this.#capacity.requireOwner();

    const decoded = Schema.decodeUnknownSync(SandboxRequest)(input);

    if (decoded.action !== SandboxAction.Show) {
      this.#requireOwnerMode({ isInstalled: false });
    }

    if (decoded.action === SandboxAction.Show) {
      const report = environmentReport({ store: this.#store, providerName: this.#providerName });

      return Schema.encodeSync(SandboxReport)(report);
    }

    return await this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);
        this.#capacity.requireOwner();

        const request = Schema.decodeUnknownSync(SandboxRequest)(input);

        if (request.action !== SandboxAction.Show) {
          await this.#armMaintenance();
        }

        const maintenance = this.#store.portableMaintenance();
        const isDeleting = Option.exists(maintenance, (job) => job.phase === SandboxPhase.Retire);

        if (request.action === SandboxAction.Delete && isDeleting && Option.isSome(this.#files.pending)) {
          const report = environmentReport({ store: this.#store, providerName: this.#providerName });

          return Schema.encodeSync(SandboxReport)(report);
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

  async restore({ request }: RestoreInput): Promise<typeof SandboxRestoreResult.Encoded> {
    this.#requireOwnerMode({ isInstalled: false });

    const decoded = Schema.decodeUnknownSync(SandboxRestoreRequest)(request);

    const result = await this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);
        this.#capacity.requireOwner();

        const retained = this.#store.workspaceRestore({ operationId: decoded.operationId });
        const isFinished = Option.exists(retained, (record) => !SandboxRestoreResult.guards.Pending(record.result));

        if (!isFinished) {
          await this.#armMaintenance();
        }

        const restored = await restoreWorkspace({
          store: this.#store,
          provider: this.#provider,
          workspace: this.#workspace,
          providerName: this.#providerName,
          request: decoded,
        });

        if (!isFinished && SandboxRestoreResult.guards.Restored(restored)) {
          await this.#armIdle();
        }

        return restored;
      },
    });

    return Schema.encodeSync(SandboxRestoreResult)(result);
  }

  async runExecution({
    executionId,
    command,
    timeoutMs,
    waitMs,
    environment,
  }: RunExecutionInput): Promise<typeof SandboxExecutionResult.Encoded> {
    this.#requireOwnerMode({ isInstalled: false });
    this.#capacity.requireOwner();

    const input = { executionId, command, timeoutMs, waitMs, environment };

    const recovery = this.#store.workspace().recovery;
    const foreground = Option.fromNullishOr(environment);

    if (Option.isSome(foreground) && Option.isSome(recovery)) {
      const previous = this.#store.execution({ executionId });

      if (Option.isNone(previous)) {
        await this.#calls.run({ run: () => resumeIdleWorkspace({ store: this.#store, provider: this.#provider }) });
      }
    }

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

  async cancelPendingExecution({ executionId }: CancelInput): Promise<typeof SandboxExecutionResult.Encoded> {
    this.#capacity.requireOwner();

    const result = cancelPendingExecution({ store: this.#store, executionId });

    return Schema.encodeSync(SandboxExecutionResult)(result);
  }

  async resumeExecution({
    executionId,
    waitMs,
    environment,
  }: ResumeInput): Promise<typeof SandboxExecutionResult.Encoded> {
    this.#requireOwnerMode({ isInstalled: false });
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

    const live = this.#store.liveMachine();
    const decodedEnvironment = Schema.decodeUnknownSync(OptionalExecutionEnvironment)(environment);

    if (
      Option.isSome(decodedEnvironment) &&
      !Option.exists(live, (machine) => machine.status === MachineStatus.Ready)
    ) {
      const now = DateTime.nowUnsafe();
      const observeAt = DateTime.addDuration(now, MAINTENANCE_RETRY);

      await this.#alarm.arm({ at: observeAt });
    }

    const timeout = Duration.millis(timeoutMs);
    const wait = Duration.millis(waitMs);

    const pending = runExecution({
      store: this.#store,
      provider: this.#provider,
      workspace: this.#workspace,
      request: { executionId, command, timeout, wait },
      environment: decodedEnvironment,
    });

    const attempted = await capturePromise({ promise: pending });

    await this.#armBackground();

    if (Result.isFailure(attempted) && Schema.is(CapacityRefused)(attempted.failure)) {
      return SandboxExecutionRefusal.cases.CapacityRefused.make({ reason: attempted.failure.reason });
    }

    return Result.getOrThrow(attempted);
  }

  async startProcess({
    generation,
    origin,
    ...input
  }: ProcessSubmissionInput): Promise<typeof SandboxProcessAnswer.Encoded> {
    this.#capacity.requireOwner();

    const { request, runId, toolCallId } = Schema.decodeUnknownSync(SandboxProcessSubmission)(input);

    const attempt = this.#runScoped({
      generation,
      run: async () => {
        const claim = { processId: request.processId, runId, toolCallId, command: request.command };

        const owner = this.#owner();
        const admitted = Option.fromNullishOr(generation);
        const provenance = Option.fromNullishOr(origin);

        claimProcess({ store: this.#store, owner, claim, generation: admitted, origin: provenance });
        await Promise.all(this.#stops);

        if (maintenanceActive({ store: this.#store })) {
          return ProcessPending.make({});
        }

        await this.#armIdle();

        return await startManagedProcess({
          store: this.#store,
          provider: this.#provider,
          workspace: this.#workspace,
          processId: request.processId,
          environment: request.environment,
          requireOwner: this.#capacity.requireOwner,
        });
      },
    });

    const result = await capturePromise({ promise: attempt });

    await this.#armBackground();

    const answer = processStartResult({ result });

    return Schema.encodeSync(SandboxProcessAnswer)(answer);
  }

  async observeProcessStart({ processId }: ProcessIdentityInput): Promise<typeof SandboxProcessAnswer.Encoded> {
    const decoded = Schema.decodeUnknownSync(ProcessId)(processId);
    const record = this.#store.process({ processId: decoded });

    if (Option.isNone(record)) {
      const refusal = SandboxExecutionRefusal.cases.ExecutionNotFound.make({});

      return Schema.encodeSync(SandboxProcessAnswer)(refusal);
    }

    const answer = Option.getOrElse(record.value.observation, () => ProcessPending.make({}));

    return Schema.encodeSync(SandboxProcessAnswer)(answer);
  }

  async readProcess({ handle, shouldTouch }: ProcessReadInput): Promise<typeof ProcessObservation.Encoded> {
    const decoded = Schema.decodeUnknownSync(ProcessHandle)(handle);

    const observation = await this.#calls.run({
      run: async () => {
        if (shouldTouch) {
          await this.#armIdle();
        }

        return await observeManagedProcess({
          store: this.#store,
          provider: this.#provider,
          handle: decoded,
          shouldStop: false,
        });
      },
    });

    await this.#armBackground();

    return Schema.encodeSync(ProcessObservation)(observation);
  }

  async stopProcess({
    handle,
    generation,
  }: ProcessHandleInput & ScopedInput): Promise<typeof ProcessObservation.Encoded> {
    const decoded = Schema.decodeUnknownSync(ProcessHandle)(handle);

    const observation = await this.#runScoped({
      generation,
      run: () =>
        observeManagedProcess({ store: this.#store, provider: this.#provider, handle: decoded, shouldStop: true }),
    });

    await this.#armBackground();

    return Schema.encodeSync(ProcessObservation)(observation);
  }

  async listProcesses({ shouldTouch }: ProcessActivityInput): Promise<typeof ProcessSummaries.Encoded> {
    this.#capacity.requireOwner();

    if (!shouldTouch) {
      const summaries = storedProcessSummaries({ store: this.#store });

      return Schema.encodeSync(ProcessSummaries)(summaries);
    }

    const summaries = await this.#calls.run({
      run: async () => {
        await this.#armIdle();

        return await listManagedProcesses({ store: this.#store, provider: this.#provider });
      },
    });

    await this.#armBackground();

    return Schema.encodeSync(ProcessSummaries)(summaries);
  }

  async cancelInteractiveRun({ runId }: InteractiveCancelInput): Promise<void> {
    this.#requireOwnerMode({ isInstalled: false });

    const decoded = Schema.decodeUnknownSync(SandboxRunId)(runId);
    const identity = { runId: decoded };

    this.#store.atomic({
      run: () => {
        this.#store.cancelInteractiveRun(identity);
        this.#store.cancelProcessRun(identity);
        this.#store.cancelBrowserRun(identity);
      },
    });

    await this.#calls.run({
      run: async () => {
        for (const record of this.#store.processes()) {
          if (record.runId === decoded && record.isStopRequested && Option.isSome(record.machineId)) {
            await observeManagedProcess({
              store: this.#store,
              provider: this.#provider,
              handle: { processId: record.processId, machineId: record.machineId.value },
              shouldStop: true,
            });
          }
        }
      },
    });
  }

  async runBrowser({ ...input }: typeof SandboxBrowserSubmission.Encoded): Promise<BrowserReceipt> {
    const submission = Schema.decodeUnknownSync(SandboxBrowserSubmission)(input);

    return await this.#runScoped({ generation: undefined, run: () => this.#submitBrowser(submission) });
  }

  async runInstalledBrowser({
    generation,
    origin,
    ...input
  }: InstalledBrowserSubmission): Promise<BrowserReceipt | typeof BrowserRequestReused.Encoded> {
    const submission = Schema.decodeUnknownSync(SandboxBrowserSubmission)(input);
    const requested = Schema.decodeUnknownSync(InstalledActionOrigin)(origin);

    const attempt = this.#runScoped({
      generation,
      run: async () => {
        const owner = this.#owner();
        const actionId = submission.request.requestId;
        const isOrigin = installedActionOriginMatches({ owner, generation, actionId, origin: requested });

        if (!isOrigin) {
          const rejected = new BrowserRequestReused({ requestId: actionId });

          return Schema.encodeSync(BrowserRequestReused)(rejected);
        }

        return await this.#submitBrowser({ ...submission, origin: requested });
      },
    });

    const result = await capturePromise({ promise: attempt });

    if (Result.isFailure(result) && Schema.is(BrowserRequestReused)(result.failure)) {
      return Schema.encodeSync(BrowserRequestReused)(result.failure);
    }

    return Result.getOrThrow(result);
  }

  async #submitBrowser({ ...submission }: BrowserClaim): Promise<BrowserReceipt> {
    this.#capacity.requireOwner();

    const call = this.#store.claimBrowserCall(submission);

    await Promise.all(this.#stops);
    await this.#armIdle();

    const result = await this.#browserEvidence({ call, shouldDispatch: true });

    return encodeBrowserReceipt({ store: this.#store, call, result });
  }

  async observeBrowser({ requestId }: BrowserIdentityInput): Promise<BrowserReceipt> {
    const decoded = Schema.decodeUnknownSync(BrowserRequestId)(requestId);
    const call = this.#store.browserCall({ requestId: decoded });

    if (Option.isNone(call)) {
      const progress = BrowserProgress.cases.Pending.make({
        isDispatchRequired: false,
        reason: 'The browser action has no sandbox receipt yet; this read does not dispatch it',
      });

      const evidence = Option.none();

      return Schema.encodeSync(BrowserEvidenceProgress)({ progress, evidence });
    }

    const result = await this.#calls.run({
      run: () => this.#browserEvidence({ call: call.value, shouldDispatch: false }),
    });

    return encodeBrowserReceipt({ store: this.#store, call: call.value, result });
  }

  async abandonBrowser({
    ...input
  }: typeof SandboxBrowserSubmission.Encoded): Promise<typeof SandboxBrowserAbandonResult.Encoded> {
    this.#requireOwnerMode({ isInstalled: false });
    this.#capacity.requireOwner();

    const submission = Schema.decodeUnknownSync(SandboxBrowserSubmission)(input);
    const call = this.#store.atomic({ run: () => this.#store.abandonBrowserCall(submission) });
    const isNotDispatched = Option.isNone(call.machineId) && Option.isNone(call.response);
    const isRefused = Option.exists(call.failure, (failure) => !failure.isUncertain);
    const isAbandoned = isNotDispatched && isRefused;

    return Schema.encodeSync(SandboxBrowserAbandonResult)({ isAbandoned });
  }

  async #browserEvidence({ call, shouldDispatch }: BrowserEvidenceInput): Promise<BrowserEvidenceProgress> {
    const owner = this.#owner();
    const identity = { ...owner, runId: call.runId, sessionId: call.sessionId, toolCallId: call.toolCallId };

    const answer = await runBrowserWithEvidence({
      store: this.#store,
      bucket: this.#workspace.bucket,
      identity,
      request: call.request,
      dispatch: async () => {
        const current = this.#store.requiredBrowserCall({ requestId: call.request.requestId });
        const needsReconciliation = Option.exists(current.failure, (failure) => failure.isUncertain);

        if (!shouldDispatch || needsReconciliation) {
          return await observeBrowser({
            store: this.#store,
            provider: this.#provider,
            requestId: call.request.requestId,
          });
        }

        const completed = browserProgress({ call: current });

        if (Option.isSome(completed)) {
          return completed.value;
        }

        if (maintenanceActive({ store: this.#store })) {
          return BrowserProgress.cases.Pending.make({
            isDispatchRequired: false,
            reason: 'The original browser request is still pending',
          });
        }

        const promise = runBrowser({
          store: this.#store,
          provider: this.#provider,
          workspace: this.#workspace,
          requestId: call.request.requestId,
        });

        const result = await capturePromise({ promise });

        if (Result.isFailure(result)) {
          const refusal = Schema.decodeUnknownResult(CapacityRefused)(result.failure);

          if (Result.isSuccess(refusal)) {
            return BrowserProgress.cases.Failed.make({ reason: `Sandbox capacity refused: ${refusal.success.reason}` });
          }
        }

        return Result.getOrThrow(result);
      },
      readArtifact: ({ machineId, request }) =>
        readBrowserArtifact({ store: this.#store, provider: this.#provider, machineId, request }),
    });

    if (!BrowserProgress.guards.Pending(answer.progress)) {
      return answer;
    }

    const current = this.#store.requiredBrowserCall({ requestId: call.request.requestId });

    const isDispatchRequired =
      Option.isNone(current.machineId) && Option.isNone(current.response) && Option.isNone(current.failure);

    return { ...answer, progress: { ...answer.progress, isDispatchRequired } };
  }

  async readBrowserArtifact({
    machineId,
    request,
  }: BrowserArtifactInput): Promise<typeof SandboxBrowserArtifactAnswer.Encoded> {
    const decodedMachineId = Schema.decodeUnknownSync(MachineId)(machineId);
    const decodedRequest = Schema.decodeUnknownSync(BrowserArtifactPartRequest)(request);

    const answer = await this.#calls.run({
      run: () =>
        readBrowserArtifact({
          store: this.#store,
          provider: this.#provider,
          machineId: decodedMachineId,
          request: decodedRequest,
        }),
    });

    return Schema.encodeSync(SandboxBrowserArtifactAnswer)(answer);
  }

  async exportEvidence({
    artifactId,
    generation,
  }: EvidenceIdentityInput & ScopedInput): Promise<typeof EvidenceExportResult.Encoded> {
    const decoded = Schema.decodeUnknownSync(EvidenceArtifactId)(artifactId);
    const owner = this.#owner();

    const result = await this.#runScoped({
      generation,
      run: async () => {
        await Promise.all(this.#stops);

        if (maintenanceActive({ store: this.#store })) {
          return EvidenceExportResult.cases.Pending.make({ reason: 'The environment is completing maintenance' });
        }

        await this.#armIdle();

        const exportedAt = DateTime.nowUnsafe();

        this.#store.noteWorkspaceActivity({ now: exportedAt });

        return await exportEvidence({
          store: this.#store,
          provider: this.#provider,
          workspace: this.#workspace,
          ...owner,
          artifactId: decoded,
        });
      },
    });

    return Schema.encodeSync(EvidenceExportResult)(result);
  }

  async listEvidence({
    ...query
  }: typeof EvidenceQuery.Encoded): Promise<ArtifactPage | typeof RequestInvalid.Encoded | null> {
    const decoded = Schema.decodeUnknownSync(EvidenceQuery)(query);
    const owner = this.#owner();
    const result = listEvidenceArtifacts({ store: this.#store, ...owner, ...decoded });

    if (Result.isFailure(result)) {
      return Schema.encodeSync(RequestInvalid)(result.failure);
    }

    if (Option.isNone(result.success)) {
      return null;
    }

    const page = result.success.value;

    if (this.#capacity.isInstalled()) {
      return encodeEvidencePage({ store: this.#store, page });
    }

    return Schema.encodeSync(EvidencePage)(page);
  }

  async showEvidence({ artifactId }: EvidenceIdentityInput): Promise<ArtifactReceipt | null> {
    const decoded = Schema.decodeUnknownSync(EvidenceArtifactId)(artifactId);
    const owner = this.#owner();
    const found = readEvidenceArtifact({ store: this.#store, ...owner, artifactId: decoded });

    if (Option.isNone(found)) {
      return null;
    }

    await cleanupReadyEvidence({ store: this.#store, bucket: this.#workspace.bucket, artifact: found.value });

    if (this.#capacity.isInstalled()) {
      return encodeEvidenceReceipt({ store: this.#store, artifact: found.value });
    }

    return Schema.encodeSync(EvidenceArtifact)(found.value);
  }

  override async fetch(request: Request): Promise<Response> {
    return await serveEvidenceContent({ request, store: this.#store, bucket: this.#workspace.bucket });
  }

  #owner(): SandboxOwner {
    return this.#capacity.requireOwner();
  }

  async stop(): Promise<typeof SandboxStopReceipt.Encoded> {
    this.#requireOwnerMode({ isInstalled: false });

    const answer = await this.#calls.run({
      run: async () => {
        const pendingStops = Promise.all(this.#stops);
        const canceled = await capturePromise({ promise: pendingStops });

        const receipt = requestSandboxStop({ store: this.#store, origin: SandboxStopOrigin.Explicit });
        const isCompleted = receipt.phase === SandboxStopPhase.Completed;

        if (Result.isFailure(canceled) && !isCompleted) {
          return failSandboxStop({
            store: this.#store,
            receipt,
            cause: canceled.failure,
            recoveryAction: SandboxRecoveryAction.RepairWorkspace,
          });
        }

        const needsRepair =
          receipt.phase === SandboxStopPhase.Failed && receipt.recoveryAction !== SandboxRecoveryAction.RetryStop;

        if (isCompleted || needsRepair) {
          return receipt;
        }

        const now = DateTime.nowUnsafe();

        this.#store.setSandboxIdleAt({ at: now });
        await this.#alarm.arm({ at: now });

        return receipt;
      },
    });

    return Schema.encodeSync(SandboxStopReceipt)(answer);
  }

  readStop({ operationId }: CheckpointInput): typeof SandboxStopObservation.Encoded {
    const identity = Schema.decodeUnknownSync(SandboxOperationId)(operationId);
    const receipt = this.#store.sandboxStop({ operationId: identity });

    if (Option.isSome(receipt)) {
      return Schema.encodeSync(SandboxStopObservation)(receipt);
    }

    const drain = this.#store.machineDrainForOperation({ operationId: identity });
    const restored = Option.map(drain, (value) => backfillSandboxStop({ store: this.#store, drain: value }));

    return Schema.encodeSync(SandboxStopObservation)(restored);
  }

  readCheckpoint({ operationId }: CheckpointInput): typeof SandboxCheckpointObservation.Encoded {
    const identity = Schema.decodeUnknownSync(SandboxOperationId)(operationId);
    const purpose = FileCheckpointPurpose.cases.Activation.make({ operationId: identity });
    const result = this.#store.fileCheckpointResult({ purpose });

    return Schema.encodeSync(SandboxCheckpointObservation)(result);
  }

  readRecoveryCheckpoint({ operationId }: CheckpointInput): typeof SandboxCheckpointObservation.Encoded {
    this.#capacity.requireOwner();

    const identity = Schema.decodeUnknownSync(SandboxOperationId)(operationId);
    const result = this.#store.recoveryCheckpointResult({ operationId: identity });

    return Schema.encodeSync(SandboxCheckpointObservation)(result);
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
    const promise = this.#advanceAlarm();
    const result = await capturePromise({ promise });

    await this.#armBackground();
    Result.getOrThrow(result);
  }

  async #advanceAlarm(): Promise<void> {
    if (this.#capacity.isInstalled()) {
      await this.#calls.run({
        run: async () => {
          await this.#onAlarm();
          await this.#advanceFiles();
        },
      });

      return;
    }

    const promise = this.#calls.run({ run: () => this.#onAlarm() });
    const advanced = await capturePromise({ promise });
    const owner = this.#owner();

    await deliverCompletions({ store: this.#store, settings: this.#runtimeSettings, owner });

    const files = this.#advanceFiles();

    this.ctx.waitUntil(files);
    Result.getOrThrow(advanced);
  }

  async #advanceFiles(): Promise<void> {
    if (Option.isSome(this.#files.pending)) {
      return await this.#files.pending.value;
    }

    const promise = this.#reconcileFiles();
    this.#files.pending = Option.some(promise);

    const settled = await capturePromise({ promise });
    this.#files.pending = Option.none();

    await this.#armBackground();
    Result.getOrThrow(settled);
  }

  async #reconcileFiles(): Promise<void> {
    const input = { store: this.#store, provider: this.#provider, workspace: this.#workspace };

    if (!this.#capacity.isInstalled()) {
      await prepareAutomaticCheckpoint(input);
    }

    const checkpoint = this.#store.workspace().checkpoint;

    if (Option.isSome(checkpoint)) {
      await advanceCheckpoint({ ...input, checkpoint: checkpoint.value });

      const state = this.#store.workspace();
      const committed = Option.exists(state.head, (head) => head.generation === checkpoint.value.generation);

      if (
        committed &&
        this.#capacity.isInstalled() &&
        FileCheckpointPurpose.guards.Recovery(checkpoint.value.purpose)
      ) {
        requestSandboxStop({ store: this.#store, origin: SandboxStopOrigin.Explicit });
      }

      if (committed && FileCheckpointPurpose.guards.Automatic(checkpoint.value.purpose)) {
        const guest = await this.#provider.connect({ machineId: checkpoint.value.machineId });

        if (Option.isSome(guest)) {
          const lease = Option.some(checkpoint.value.lease);

          await releaseWorkspaceGeneration({
            guest: guest.value,
            machineId: checkpoint.value.machineId,
            generation: checkpoint.value.generation,
            lease,
          });
        }
      }
    }

    await retireWorkspace(input);
  }

  async #onAlarm(): Promise<void> {
    await Promise.all(this.#stops);

    const recovery = this.#store.pendingRecoveryCheckpoint();
    const checkpoint = this.#store.workspace().checkpoint;

    if (Option.isSome(recovery) && Option.isNone(checkpoint)) {
      await resumeRecoveryCheckpoint({
        store: this.#store,
        provider: this.#provider,
        workspace: this.#workspace,
        purpose: recovery.value,
      });
    }

    const promise = observeBackgroundWork({ store: this.#store, provider: this.#provider, workspace: this.#workspace });
    const observation = await capturePromise({ promise });

    if (Result.isFailure(observation)) {
      writeBackgroundObservationFailure();
    }

    const reservation = this.#capacity.reservation();

    if (
      Option.isSome(reservation) &&
      reservation.value.phase === ReservationPhase.Stopping &&
      !this.#hasPendingStop()
    ) {
      await this.#armRetry();

      const cacheCheckpoint = Option.none();

      await this.#provider.stop({ machineId: reservation.value.machineId, checkpoint: cacheCheckpoint });
    }

    if (maintenanceActive({ store: this.#store })) {
      await this.#armMaintenance();

      const maintenance = this.#store.portableMaintenance();
      const job = maintenanceValue({ value: maintenance, field: 'portableMaintenance' });
      const operationId = Option.some(job.id);

      if (job.phase === SandboxPhase.Retire && Option.isSome(this.#files.pending)) {
        return;
      }

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

    const workspace = this.#store.workspace();

    if (Option.isSome(workspace.recovery)) {
      recordFailedDrain({ store: this.#store, recovery: workspace.recovery.value });

      return;
    }

    if (this.#capacity.isInstalled() && !this.#hasPendingStop()) {
      this.#store.clearSandboxIdleAt();

      return;
    }

    const idleAt = this.#store.sandboxIdleAt();
    const now = DateTime.nowUnsafe();
    const stop = this.#store.latestSandboxStop();

    const requiresWorkspaceRepair = Option.exists(
      stop,
      (receipt) =>
        receipt.phase === SandboxStopPhase.Failed && receipt.recoveryAction === SandboxRecoveryAction.RepairWorkspace,
    );

    if (Option.isNone(idleAt) && requiresWorkspaceRepair) {
      return;
    }

    if (Option.isSome(idleAt) && DateTime.isLessThan(now, idleAt.value) && !this.#hasPendingStop()) {
      await this.#alarm.arm({ at: idleAt.value });

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
    } else {
      this.#store.clearSandboxIdleAt();
    }
  }

  async #stopIdleMachine({ machineId }: MachineIdInput): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, STOP_RETRY);

    await this.#alarm.arm({ at });

    const receipt = await advanceSandboxStop({
      store: this.#store,
      provider: this.#provider,
      workspace: this.#workspace,
      machineId,
    });

    if (receipt.phase === SandboxStopPhase.Canceled) {
      return;
    }

    if (receipt.phase === SandboxStopPhase.Failed && receipt.recoveryAction !== SandboxRecoveryAction.RetryStop) {
      this.#store.clearSandboxIdleAt();
      await this.#alarm.disarmAt({ at });

      return;
    }

    if (receipt.phase !== SandboxStopPhase.Completed) {
      const checkpoint = this.#store.workspace().checkpoint;

      if (Option.isSome(checkpoint) || receipt.phase === SandboxStopPhase.Canceling) {
        const retryNow = DateTime.nowUnsafe();
        const retrySpan = Duration.seconds(1);
        const retryAt = DateTime.addDuration(retryNow, retrySpan);

        await this.#alarm.arm({ at: retryAt });
      }

      return;
    }

    this.#store.clearSandboxIdleAt();
    await this.#alarm.disarmAt({ at });
  }

  async #armIdle(): Promise<void> {
    if (this.#capacity.isInstalled()) {
      return;
    }

    const now = DateTime.nowUnsafe();
    const live = this.#store.liveMachine();

    const drain = Option.flatMap(live, ({ id }) => {
      const machineId = MachineId.make(id);

      return this.#store.machineDrain({ machineId });
    });

    if (Option.isSome(drain)) {
      await this.#alarm.arm({ at: now });

      return;
    }

    const at = DateTime.addDuration(now, SANDBOX_IDLE);

    this.#store.setSandboxIdleAt({ at });
    await this.#alarm.arm({ at });
    await this.#armBackground();
  }

  async #armBackground(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const nextCompletion = this.#store.nextCompletionAt();
    const idleAt = this.#store.sandboxIdleAt();
    const workspace = this.#store.workspace();
    const hasRecovery = Option.isSome(workspace.recovery);

    if (!hasRecovery && this.#hasPendingStop()) {
      await this.#armRetry();
    }

    if (Option.isSome(idleAt) && !hasRecovery) {
      const at = DateTime.max(now, idleAt.value);

      await this.#alarm.arm({ at });
    }

    if (!this.#capacity.isInstalled() && Option.isSome(nextCompletion)) {
      const at = DateTime.max(now, nextCompletion.value);

      await this.#alarm.arm({ at });
    }

    const checkpoint = workspace.checkpoint;
    const work = this.#store.backgroundWork();

    const live = this.#store.liveMachine();
    const latest = this.#store.latestMachine();
    const active = this.#store.activeExecution();
    const isMaintenanceActive = maintenanceActive({ store: this.#store });

    const retainedRecovery = Option.filter(workspace.recovery, (recovery) =>
      Option.exists(latest, (machine) => machine.id === recovery.machineId),
    );

    if (Option.isSome(retainedRecovery) && !isMaintenanceActive) {
      const promise = this.#provider.connect({ machineId: retainedRecovery.value.machineId });
      const connected = await capturePromise({ promise });

      const shouldObserveRecovery = Result.match(connected, {
        onFailure: () => true,
        onSuccess: (guest) => Option.isSome(guest) || Option.isSome(live),
      });

      if (shouldObserveRecovery) {
        const observedAt = DateTime.nowUnsafe();
        const at = DateTime.addDuration(observedAt, RECOVERY_OBSERVE_INTERVAL);

        await this.#alarm.arm({ at });
      }
    }

    const usesAutomaticCheckpoints = !this.#capacity.isInstalled() && Option.isNone(this.#files.pending);
    const canScheduleAutomatic = usesAutomaticCheckpoints && Option.isSome(live) && !isMaintenanceActive;

    const isWorkspaceAvailable =
      Option.isNone(checkpoint) && Option.isNone(active) && Option.isNone(workspace.recovery);

    if (canScheduleAutomatic && isWorkspaceAvailable && Option.isSome(workspace.automaticAt)) {
      const forceAt = workspace.automaticAt.value;
      const quiet = Option.map(workspace.lastActivityAt, (at) => DateTime.addDuration(at, AUTOMATIC_CHECKPOINT_QUIET));

      const hasPendingActivity = Option.match(workspace.head, {
        onNone: () => workspace.activitySequence > 0,
        onSome: (head) => !Option.contains(head.capturedSequence, workspace.activitySequence),
      });

      const automaticAt = Option.match(quiet, {
        onNone: () => forceAt,
        onSome: (at) => {
          if (hasPendingActivity && Option.isNone(workspace.checkpointError)) {
            return DateTime.min(at, forceAt);
          }

          return forceAt;
        },
      });

      const at = DateTime.max(now, automaticAt);

      await this.#alarm.arm({ at });
    }

    const recovery = this.#store.pendingRecoveryCheckpoint();
    const pending = this.#store.latestPendingExecutionAt();

    const isPreparing =
      Option.exists(live, (machine) => machine.status === MachineStatus.Starting) && Option.isSome(pending);

    const needsWorkspaceReconciliation = Option.isSome(checkpoint) || Option.isSome(recovery);

    if (!isPreparing && BackgroundWork.guards.Idle(work) && !needsWorkspaceReconciliation) {
      return;
    }

    let interval = BACKGROUND_OBSERVE_INTERVAL;

    if (isPreparing || Option.isSome(checkpoint)) {
      interval = MAINTENANCE_RETRY;
    }

    const at = DateTime.addDuration(now, interval);

    await this.#alarm.arm({ at });
  }

  async #armRetry(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, STOP_RETRY);

    await this.#alarm.arm({ at });
  }

  #hasPendingStop(): boolean {
    const stop = this.#store.latestSandboxStop();
    const reservation = this.#capacity.reservation();
    const lastMachine = this.#store.latestMachine();
    const held = Option.map(reservation, ({ machineId }) => machineId);
    const latest = Option.map(lastMachine, ({ id }) => id);
    const machineId = Option.orElse(held, () => latest);

    if (Option.isNone(machineId) || Option.isNone(stop)) {
      return false;
    }

    const receipt = stop.value;

    if (!Option.contains(receipt.machineId, machineId.value) || SETTLED_STOP_PHASES.has(receipt.phase)) {
      return false;
    }

    if (receipt.phase === SandboxStopPhase.Failed) {
      return receipt.recoveryAction === SandboxRecoveryAction.RetryStop;
    }

    return true;
  }

  async #armMaintenance(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, MAINTENANCE_RETRY);

    await this.#alarm.arm({ at });
  }
}
