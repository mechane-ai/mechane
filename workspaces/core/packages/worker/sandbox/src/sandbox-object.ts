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
  FileCheckpointIdentityReused,
  FileCheckpointPurpose,
  openSandboxStore,
  ReservationPhase,
  sandboxAlarm,
} from '@mechane/sandbox-store';
import {
  BrowserArtifactPartRequest,
  BrowserProgress,
  BrowserRequestId,
  EvidenceExportResult,
  ExecutionProgress,
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
  SandboxProcessAnswer,
  SandboxProcessSubmission,
  SandboxRecoveryAction,
  SandboxRecoveryCheckpointRefusal,
  SandboxRecoveryCheckpointRefusalReason,
  SandboxRecoveryCheckpointRequest,
  SandboxRecoveryCheckpointResult,
  SandboxReport,
  SandboxRequest,
  SandboxRunId,
  SandboxStopObservation,
  SandboxStopPhase,
  SandboxStopReceipt,
} from '@mechane/sandbox-wire';
import type { ExecutionId, RunExecutionInput } from '@mechane/sandbox-wire';
import { afterSettling, capturePromise } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { DateTime, Duration, Option, Result, Schema } from 'effect';
import { browserProgress } from './browser/browser-progress.ts';
import { observeBrowser } from './browser/observe-browser.ts';
import { readBrowserArtifact } from './browser/read-browser-artifact.ts';
import { runBrowser } from './browser/run-browser.ts';
import { capacityClient } from './capacity/capacity-client.ts';
import { CapacityRefused, machineCapacity } from './capacity/machine-capacity.ts';
import { runFileCheckpoint } from './checkpoints/run-file-checkpoint.ts';
import { resumeRecoveryCheckpoint } from './checkpoints/run-recovery-checkpoint.ts';
import { deliverCompletions } from './completions/deliver-completions.ts';
import { observeBackgroundWork } from './completions/observe-background-work.ts';
import { BACKGROUND_OBSERVE_INTERVAL, MAINTENANCE_RETRY, SANDBOX_IDLE, STOP_RETRY } from './constants.ts';
import type { SandboxEnvironment, SandboxRuntimeSettings } from './environment.ts';
import { RecoveryCheckpointRefused } from './errors.ts';
import { runBrowserWithEvidence } from './evidence/browser-evidence.ts';
import { cleanupReadyEvidence } from './evidence/evidence-cleanup.ts';
import { exportEvidence } from './evidence/export-evidence.ts';
import { listEvidenceArtifacts, readEvidenceArtifact } from './evidence/read-evidence.ts';
import { cancelActiveExecutions } from './executions/cancel-active-executions.ts';
import { cancelExecution } from './executions/cancel-execution.ts';
import { claimExecution } from './executions/claim-execution.ts';
import { executionProgress } from './executions/execution-progress.ts';
import { runExecution } from './executions/run-execution.ts';
import { maintenanceActive } from './maintenance/maintenance-active.ts';
import { maintenanceValue } from './maintenance/maintenance-value.ts';
import { managePortable } from './maintenance/manage-portable.ts';
import { writeBackgroundObservationFailure } from './output/write-sandbox-diagnostic.ts';
import { listManagedProcesses } from './processes/list-managed-processes.ts';
import { observeManagedProcess, startManagedProcess } from './processes/managed-processes.ts';
import { machineProvider } from './providers/machine-provider.ts';
import { sandboxSettings } from './providers/sandbox-settings.ts';
import { sandboxCalls } from './sandbox-calls.ts';
import { serveEvidenceContent } from './service/serve-evidence-content.ts';
import type { MachineIdInput, MachineProvider, WorkspaceFiles } from './types.ts';
import { advanceSandboxStop, failSandboxStop } from './workspace/advance-sandbox-stop.ts';
import { backfillSandboxStop } from './workspace/backfill-sandbox-stop.ts';
import { requestSandboxStop } from './workspace/request-sandbox-stop.ts';

type BindOwnerInput = { readonly owner: typeof SandboxOwner.Encoded };
type ManageInput = { readonly request: typeof SandboxRequest.Encoded };
type CheckpointInput = { readonly operationId: SandboxOperationId };
type RecoveryCheckpointInput = CheckpointInput & { readonly request: typeof SandboxRecoveryCheckpointRequest.Encoded };
type ObserveInput = Pick<RunExecutionInput, 'executionId' | 'waitMs'>;
type ResumeInput = ObserveInput & { readonly environment: RunExecutionInput['environment'] };
type CancelInput = { readonly executionId: ExecutionId };
type StopCallInput = { readonly promise: Promise<void> };

type ProcessIdentityInput = { readonly processId: ProcessId };
type ProcessHandleInput = { readonly handle: typeof ProcessHandle.Encoded };
type ProcessReadInput = ProcessHandleInput & ProcessActivityInput;
type ProcessActivityInput = { readonly shouldTouch: boolean };
type InteractiveCancelInput = { readonly runId: SandboxRunId };
type BrowserIdentityInput = { readonly requestId: BrowserRequestId };
type BrowserEvidenceInput = { readonly call: BrowserCall; readonly shouldDispatch: boolean };

type BrowserArtifactInput = {
  readonly machineId: MachineId;
  readonly request: typeof BrowserArtifactPartRequest.Encoded;
};

type EvidenceIdentityInput = { readonly artifactId: EvidenceArtifactId };

type ProcessStartResultInput = { readonly result: Result.Result<SandboxProcessAnswer, unknown> };

function processStartResult({ result }: ProcessStartResultInput): SandboxProcessAnswer {
  if (Result.isFailure(result)) {
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
  readonly #workspace: WorkspaceFiles;
  readonly #runtimeSettings: SandboxRuntimeSettings;
  readonly #calls = sandboxCalls();
  readonly #stops = new Set<Promise<void>>();

  constructor(state: DurableObjectState, environment: SandboxEnvironment) {
    super(state, environment);

    this.#store = openSandboxStore({ storage: state.storage });
    this.#alarm = sandboxAlarm({ storage: state.storage });

    void state.blockConcurrencyWhile(async () => {
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

    const settings = sandboxSettings({ store: this.#store, environment });
    const provider = machineProvider({ settings: settings.variables, state });

    this.#workspace = { bucket: settings.workspaceBucket, owner: state.id.toString() };
    this.#providerName = settings.variables.provider;
    this.#runtimeSettings = settings.runtime;
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

  async completionReceipt({ executionId }: CancelInput): Promise<typeof SandboxCompletionReceipt.Encoded | null> {
    this.#capacity.requireOwner();

    const stored = this.#store.completionReceipt({ executionId });
    const encode = Schema.encodeSync(SandboxCompletionReceipt);

    return Option.match(stored, { onNone: () => null, onSome: encode });
  }

  async checkpoint({ operationId }: CheckpointInput): Promise<typeof SandboxCheckpointResult.Encoded> {
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

  async retryCheckpoint({
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

    await this.#armBackground();

    if (Result.isFailure(attempted) && Schema.is(CapacityRefused)(attempted.failure)) {
      return SandboxExecutionRefusal.cases.CapacityRefused.make({ reason: attempted.failure.reason });
    }

    return Result.getOrThrow(attempted);
  }

  async startProcess({
    ...input
  }: typeof SandboxProcessSubmission.Encoded): Promise<typeof SandboxProcessAnswer.Encoded> {
    this.#capacity.requireOwner();

    const { request, runId, toolCallId } = Schema.decodeUnknownSync(SandboxProcessSubmission)(input);

    this.#store.claimProcess({ processId: request.processId, runId, toolCallId, command: request.command });

    const attempt = this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);

        if (maintenanceActive({ store: this.#store })) {
          return ProcessPending.make({});
        }

        await this.#touchInteractive();

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
          await this.#touchInteractive();
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

  async stopProcess({ handle }: ProcessHandleInput): Promise<typeof ProcessObservation.Encoded> {
    const decoded = Schema.decodeUnknownSync(ProcessHandle)(handle);

    const observation = await this.#calls.run({
      run: () =>
        observeManagedProcess({ store: this.#store, provider: this.#provider, handle: decoded, shouldStop: true }),
    });

    await this.#armBackground();

    return Schema.encodeSync(ProcessObservation)(observation);
  }

  async listProcesses({ shouldTouch }: ProcessActivityInput): Promise<typeof ProcessSummaries.Encoded> {
    const summaries = await this.#calls.run({
      run: async () => {
        if (shouldTouch) {
          await this.#touchInteractive();
        }

        return await listManagedProcesses({ store: this.#store, provider: this.#provider });
      },
    });

    await this.#armBackground();

    return Schema.encodeSync(ProcessSummaries)(summaries);
  }

  async cancelInteractiveRun({ runId }: InteractiveCancelInput): Promise<void> {
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

  async runBrowser({
    ...input
  }: typeof SandboxBrowserSubmission.Encoded): Promise<typeof BrowserEvidenceProgress.Encoded> {
    this.#capacity.requireOwner();

    const submission = Schema.decodeUnknownSync(SandboxBrowserSubmission)(input);
    const call = this.#store.claimBrowserCall(submission);

    const result = await this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);
        await this.#touchInteractive();

        return await this.#browserEvidence({ call, shouldDispatch: true });
      },
    });

    return Schema.encodeSync(BrowserEvidenceProgress)(result);
  }

  async observeBrowser({ requestId }: BrowserIdentityInput): Promise<typeof BrowserEvidenceProgress.Encoded> {
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

    return Schema.encodeSync(BrowserEvidenceProgress)(result);
  }

  async abandonBrowser({
    ...input
  }: typeof SandboxBrowserSubmission.Encoded): Promise<typeof SandboxBrowserAbandonResult.Encoded> {
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

  async exportEvidence({ artifactId }: EvidenceIdentityInput): Promise<typeof EvidenceExportResult.Encoded> {
    const decoded = Schema.decodeUnknownSync(EvidenceArtifactId)(artifactId);
    const owner = this.#owner();

    const result = await this.#calls.run({
      run: async () => {
        await Promise.all(this.#stops);

        if (maintenanceActive({ store: this.#store })) {
          return EvidenceExportResult.cases.Pending.make({ reason: 'The environment is completing maintenance' });
        }

        await this.#touchInteractive();

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
  }: typeof EvidenceQuery.Encoded): Promise<typeof EvidencePage.Encoded | typeof RequestInvalid.Encoded | null> {
    const decoded = Schema.decodeUnknownSync(EvidenceQuery)(query);
    const owner = this.#owner();
    const result = listEvidenceArtifacts({ store: this.#store, ...owner, ...decoded });

    if (Result.isFailure(result)) {
      return Schema.encodeSync(RequestInvalid)(result.failure);
    }

    const encode = Schema.encodeSync(EvidencePage);

    return Option.match(result.success, { onNone: () => null, onSome: encode });
  }

  async showEvidence({ artifactId }: EvidenceIdentityInput): Promise<typeof EvidenceArtifact.Encoded | null> {
    const decoded = Schema.decodeUnknownSync(EvidenceArtifactId)(artifactId);
    const owner = this.#owner();
    const found = readEvidenceArtifact({ store: this.#store, ...owner, artifactId: decoded });

    if (Option.isNone(found)) {
      return null;
    }

    await cleanupReadyEvidence({ store: this.#store, bucket: this.#workspace.bucket, artifact: found.value });

    return Schema.encodeSync(EvidenceArtifact)(found.value);
  }

  override async fetch(request: Request): Promise<Response> {
    return await serveEvidenceContent({ request, store: this.#store, bucket: this.#workspace.bucket });
  }

  #owner(): SandboxOwner {
    return this.#capacity.requireOwner();
  }

  async #touchInteractive(): Promise<void> {
    const live = this.#store.liveMachine();

    const drain = Option.flatMap(live, ({ id }) => {
      const machineId = MachineId.make(id);

      return this.#store.machineDrain({ machineId });
    });

    if (Option.isSome(drain)) {
      const at = DateTime.nowUnsafe();

      await this.#alarm.arm({ at });

      return;
    }

    await this.#armIdle();
  }

  async stop(): Promise<typeof SandboxStopReceipt.Encoded> {
    const answer = await this.#calls.run({
      run: async () => {
        const pendingStops = Promise.all(this.#stops);
        const canceled = await capturePromise({ promise: pendingStops });

        const receipt = requestSandboxStop({ store: this.#store });
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
    const promise = this.#calls.run({ run: () => this.#onAlarm() });
    const advanced = await capturePromise({ promise });
    const owner = this.#owner();

    await deliverCompletions({ store: this.#store, settings: this.#runtimeSettings, owner });
    Result.getOrThrow(advanced);
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

    if (Option.isSome(idleAt) && DateTime.isLessThan(now, idleAt.value)) {
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

    if (receipt.phase === SandboxStopPhase.Failed && receipt.recoveryAction !== SandboxRecoveryAction.RetryStop) {
      this.#store.clearSandboxIdleAt();
      await this.#alarm.disarmAt({ at });

      return;
    }

    if (receipt.phase !== SandboxStopPhase.Completed) {
      const checkpoint = this.#store.workspace().checkpoint;

      if (Option.isSome(checkpoint)) {
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
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, SANDBOX_IDLE);

    this.#store.setSandboxIdleAt({ at });
    await this.#alarm.arm({ at });
    await this.#armBackground();
  }

  async #armBackground(): Promise<void> {
    const now = DateTime.nowUnsafe();
    const nextCompletion = this.#store.nextCompletionAt();
    const idleAt = this.#store.sandboxIdleAt();

    if (Option.isSome(idleAt)) {
      const at = DateTime.max(now, idleAt.value);

      await this.#alarm.arm({ at });
    }

    if (Option.isSome(nextCompletion)) {
      const at = DateTime.max(now, nextCompletion.value);

      await this.#alarm.arm({ at });
    }

    const checkpoint = this.#store.workspace().checkpoint;
    const work = this.#store.backgroundWork();

    const recovery = this.#store.pendingRecoveryCheckpoint();

    if (BackgroundWork.guards.Idle(work) && Option.isNone(checkpoint) && Option.isNone(recovery)) {
      return;
    }

    const at = DateTime.addDuration(now, BACKGROUND_OBSERVE_INTERVAL);

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
