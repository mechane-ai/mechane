import { RecordId } from '@mechane/records';
import { Option, Schema } from 'effect';
import { SandboxRecoveryCheckpointRequest } from './checkpoint.ts';
import { ExecutionEnvironment } from './execution-environment.ts';
import { MANAGED_WORK_PATH, ManagedWorkerAllocation } from './managed-work.ts';
import type { ManagedWorkerClaim } from './managed-work.ts';
import type { SandboxOwner } from './sandbox-owner.ts';

type SessionPath = Pick<ManagedWorkerClaim, 'sessionId'> & { readonly resource: string };

type ServicePath = SessionPath &
  Pick<typeof SandboxOwner.Encoded, 'workspaceId'> &
  Pick<ManagedWorkerClaim, 'environmentId'>;

type Operation = { readonly method: string; readonly resource: string };
type Access = 'observe' | 'tool' | 'repair';

export const InstalledProcessCommand = Schema.Struct({ command: Schema.NonEmptyString });

export const InstalledProcessSubmission = Schema.Struct({
  ...InstalledProcessCommand.fields,
  environment: Schema.optionalKey(ExecutionEnvironment),
});

export const InstalledCheckpointRepair = Schema.Struct({
  generation: ManagedWorkerAllocation.fields.generation,
  ...SandboxRecoveryCheckpointRequest.fields,
});

export function installedComputerPath({ sessionId, resource }: SessionPath): string {
  return `/internal/managed/sessions/${encodeURIComponent(sessionId)}/computer/${resource}`;
}

export function installedComputerServicePath({ workspaceId, environmentId, sessionId, resource }: ServicePath): string {
  return [MANAGED_WORK_PATH, workspaceId, environmentId, sessionId, resource].join('/');
}

const operations: ReadonlyMap<string, Access> = new Map([
  ['GET workspace', 'observe'],
  ['GET allocation', 'observe'],
  ['POST workspace/recovery-checkpoints/:id', 'repair'],
  ['GET workspace/checkpoints/:id', 'observe'],
  ['GET workspace/recovery-checkpoints/:id', 'observe'],
  ['GET stop/:id', 'observe'],
  ['GET processes', 'observe'],
  ['GET processes/:id', 'observe'],
  ['POST processes/:id/read', 'observe'],
  ['GET browser/:id', 'observe'],
  ['GET evidence', 'observe'],
  ['GET evidence/:id', 'observe'],
  ['GET evidence/:id/content', 'observe'],
  ['HEAD evidence/:id/content', 'observe'],
  ['GET completions', 'observe'],
  ['GET completions/:id', 'observe'],
  ['POST processes/:id', 'tool'],
  ['POST processes/:id/stop', 'tool'],
  ['POST browser/:id', 'tool'],
  ['POST evidence/:id/export', 'tool'],
]);

export function installedComputerAccess({ method, resource }: Operation): Option.Option<Access> {
  if (resource.includes(':')) {
    return Option.none();
  }

  const parts = resource.split('/').map((part) => {
    if (Schema.is(RecordId)(part)) {
      return ':id';
    }

    return part;
  });

  const normalized = parts.join('/');
  const matched = operations.get(`${method} ${normalized}`);

  return Option.fromNullishOr(matched);
}

const WORKER_ACCESS: ReadonlySet<Access> = new Set(['observe', 'tool']);

export function isInstalledWorkerComputerOperation({ method, resource }: Operation): boolean {
  const operation = installedComputerAccess({ method, resource });

  return Option.exists(operation, (access) => WORKER_ACCESS.has(access));
}
