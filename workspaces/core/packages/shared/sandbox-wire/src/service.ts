import { renamedWireStruct, SandboxOperationId } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { SandboxCapacityRefusalReason } from './capacity.ts';
import { EXECUTION_WAIT_MAX } from './constants.ts';
import { OptionalExecutionEnvironment } from './execution-environment.ts';
import { SandboxOwner } from './sandbox-owner.ts';
import { ExecutionAttempt, ExecutionCommand, ExecutionId, ExecutionTimeout, ExecutionWaitSpan } from './schemas.ts';

export const SANDBOX_SERVICE_PREFIX = '/internal/sandboxes';

export const SandboxServiceIdentity = SandboxOwner;
export type SandboxServiceIdentity = typeof SandboxServiceIdentity.Type;

export const SandboxStopIdentity = Schema.Struct({ ...SandboxServiceIdentity.fields, operationId: SandboxOperationId });

export type SandboxStopIdentity = typeof SandboxStopIdentity.Type;

export const SandboxExecutionIdentity = Schema.Struct({ ...SandboxServiceIdentity.fields, executionId: ExecutionId });
export type SandboxExecutionIdentity = typeof SandboxExecutionIdentity.Type;

export const SandboxExecutionSubmission = renamedWireStruct({
  fields: {
    command: ExecutionCommand,
    timeout: ExecutionTimeout,
    wait: ExecutionWaitSpan,
    environment: OptionalExecutionEnvironment,
  },
  renames: { timeout: 'timeoutMs', wait: 'waitMs' },
});

export type SandboxExecutionSubmission = typeof SandboxExecutionSubmission.Type;

export const SandboxExecutionResume = renamedWireStruct({
  fields: { wait: ExecutionWaitSpan, environment: OptionalExecutionEnvironment },
  renames: { wait: 'waitMs' },
});

export type SandboxExecutionResume = typeof SandboxExecutionResume.Type;

export const SandboxExecutionObservation = Schema.Struct({
  waitMs: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: Duration.toMillis(EXECUTION_WAIT_MAX) }),
  ),
});

export const SandboxExecutionRefusal = Schema.TaggedUnion({
  ExecutionNotFound: {},
  ExecutionReused: {},
  CapacityRefused: { reason: SandboxCapacityRefusalReason },
});

export type SandboxExecutionRefusal = typeof SandboxExecutionRefusal.Type;

export const SandboxExecutionResult = Schema.Union([ExecutionAttempt, SandboxExecutionRefusal]);
export type SandboxExecutionResult = typeof SandboxExecutionResult.Type;
