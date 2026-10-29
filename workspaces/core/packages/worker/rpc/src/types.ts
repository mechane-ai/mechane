import type { SandboxReport } from '@mechane/protocol';
import type { ExecutionProgress, RunExecutionInput, SourceFenceReport, SourceGuestAnswer } from '@mechane/sandbox-wire';
import type { DirectoryRpc } from './directory.types.ts';
import type { KeyCacheRpc } from './key-cache.types.ts';
import type { LimiterRpc } from './limits.types.ts';
import type { MechRpc } from './mech/types.ts';
import type { SandboxCancelInput, SandboxManageInput } from './sandbox.types.ts';
import type { MechVariables } from './schemas.ts';
import type { SourceCaptureInput, SourceCloneInput, SourceIdentityInput, SourcePrepareInput } from './source.types.ts';
import type { WorkspaceRpc } from './workspace.types.ts';

/** The Durable Object namespaces the Worker and the objects call. */
export type ObjectBindings = {
  readonly workspaceFiles: R2Bucket;
  readonly directory: DurableObjectNamespace<DirectoryRpc>;
  readonly workspaces: DurableObjectNamespace<WorkspaceRpc>;
  readonly mechs: DurableObjectNamespace<MechRpc>;
  readonly sandboxes: DurableObjectNamespace<SandboxRpc>;
  readonly limiters: DurableObjectNamespace<LimiterRpc>;
  readonly keyCaches: DurableObjectNamespace<KeyCacheRpc>;
};

/**
 * The bindings and variables the Workers runtime passes the Worker and each Durable Object, as `wrangler.jsonc` and the
 * deployment declare them.
 */
export type WorkerEnvironment = {
  readonly DIRECTORY: DurableObjectNamespace<DirectoryRpc>;
  readonly WORKSPACES: DurableObjectNamespace<WorkspaceRpc>;
  readonly MECHS: DurableObjectNamespace<MechRpc>;
  readonly SANDBOXES: DurableObjectNamespace<SandboxRpc>;
  readonly LIMITERS: DurableObjectNamespace<LimiterRpc>;
  readonly KEY_CACHES: DurableObjectNamespace<KeyCacheRpc>;
  readonly RELEASES: R2Bucket;
  readonly WORKSPACE_FILES: R2Bucket;
};

/**
 * Everything a mech's object reads from its environment: the model it reaches, its workspace's sandboxes and
 * suspension, how long its alarm lets pi work, and the objects it calls.
 */
export type ObjectSettings = MechVariables & ObjectBindings;

export type BindingsInput = { readonly bindings: ObjectBindings };

export type DecodeSettingsInput = { readonly environment: WorkerEnvironment };

/** Each RPC method of a sandbox's object. */
type SandboxMethods = {
  readonly prepareSource: (input: SourcePrepareInput) => Promise<typeof SourceFenceReport.Encoded>;
  readonly cloneSource: (input: SourceCloneInput) => Promise<typeof SourceFenceReport.Encoded>;
  readonly revokeSource: (input: SourceIdentityInput) => Promise<typeof SourceFenceReport.Encoded>;
  readonly finishSource: (input: SourceIdentityInput) => Promise<typeof SourceFenceReport.Encoded>;
  readonly captureSource: (input: SourceCaptureInput) => Promise<typeof SourceGuestAnswer.Encoded>;
  readonly manage: (input: SandboxManageInput) => Promise<typeof SandboxReport.Encoded>;
  /** The count of schema migrations the sandbox's database has applied. */
  readonly schemaRevision: () => Promise<number>;
  readonly runExecution: (input: RunExecutionInput) => Promise<typeof ExecutionProgress.Encoded>;
  readonly cancelExecution: (input: SandboxCancelInput) => Promise<void>;
  readonly cancelActiveExecutions: () => Promise<void>;
  /** Stops the machine opened last at once, as the idle stop does, for an owner whose work there ended. */
  readonly stop: () => Promise<void>;
};

/**
 * The methods a sandbox's object serves by RPC, each answering with plain data its caller decodes. The settings name
 * the object by this type, so they need not import the object, which reads those settings itself.
 */
/** The sandbox methods reached only through its owning mech. */
export type SandboxRpc = Rpc.DurableObjectBranded & SandboxMethods;
