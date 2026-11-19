import {
  EvidenceArtifactId,
  HttpHeader,
  HttpMethod,
  HttpStatusCode,
  ModelToolCallId,
  recordIdFromDigest,
  SandboxOperationId,
  SessionId,
} from '@mechane/records';
import {
  BrowserAction,
  BrowserRequestId,
  ExecutionEnvironment,
  InstalledCheckpointRepair,
  installedComputerAccess,
  InstalledProcessSubmission,
  ManagedWorkerAllocation,
  ManagedWorkerClaim,
  ProcessHandle,
  ProcessId,
  SandboxRecoveryCheckpointRequest,
  SandboxRunId,
} from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { createHash } from 'node:crypto';
import type { SandboxObject } from '../sandbox-object.ts';
import type { InstalledSession } from './managed-sandbox.ts';
import { readBody } from './read-body.ts';
import { recoveryCheckpointResponse } from './recovery-checkpoint-response.ts';

type ComputerRequest = {
  readonly request: Request;
  readonly stub: DurableObjectStub<SandboxObject>;
  readonly session: typeof InstalledSession.Type;
  readonly resource: string;
};

function missing(): Response {
  return new Response(null, { status: HttpStatusCode.NotFound });
}

function internalRecordId(value: string) {
  const digest = createHash('sha256').update(value).digest('hex');

  return recordIdFromDigest({ digest });
}

export async function serveInstalledComputer({
  request,
  stub,
  session,
  resource,
}: ComputerRequest): Promise<Response | null> {
  const classification = installedComputerAccess({ method: request.method, resource });

  if (Option.isNone(classification)) {
    return missing();
  }

  const access = classification.value;

  const [group, id, action] = resource.split('/');

  if (access === 'repair') {
    const operationId = Schema.decodeUnknownSync(SandboxOperationId)(action);
    const body = await readBody(request);

    const { generation, ...repair } = Schema.decodeUnknownSync(InstalledCheckpointRepair, {
      onExcessProperty: 'error',
    })(body);

    const native = Schema.encodeSync(SandboxRecoveryCheckpointRequest)(repair);
    const result = await stub.managedRepairCheckpoint({ generation, operationId, request: native });

    return recoveryCheckpointResponse({ result });
  }

  if (group === 'completions') {
    if (id !== undefined) {
      const processId = Schema.decodeUnknownSync(ProcessId)(id);
      const receipt = await stub.installedCompletion({ processId });

      if (receipt === null) {
        return missing();
      }

      return Response.json(receipt);
    }

    const after = new URL(request.url).searchParams.get('after');

    return Response.json(await stub.installedCompletions({ after }));
  }

  if (access !== 'tool') {
    return null;
  }

  const workId = Schema.decodeUnknownSync(ManagedWorkerClaim.fields.workId)(
    request.headers.get(HttpHeader.MechaneWorkId),
  );

  const value = Number(request.headers.get(HttpHeader.MechaneAllocationGeneration));
  const generation = Schema.decodeUnknownSync(ManagedWorkerAllocation.fields.generation)(value);
  const runId = SandboxRunId.make(internalRecordId(workId));
  const toolCallId = Schema.decodeUnknownSync(ModelToolCallId)(id);

  if (group === 'processes') {
    const processId = Schema.decodeUnknownSync(ProcessId)(id);

    if (action === 'stop') {
      const body = await readBody(request);
      const handle = Schema.decodeUnknownSync(ProcessHandle, { onExcessProperty: 'error' })(body);

      if (handle.processId !== processId) {
        return missing();
      }

      return Response.json(await stub.stopProcess({ handle: Schema.encodeSync(ProcessHandle)(handle), generation }));
    }

    const submission = Schema.decodeUnknownSync(InstalledProcessSubmission, { onExcessProperty: 'error' })(
      await readBody(request),
    );

    const { command } = submission;

    const native: { process_id: string; command: string; environment?: typeof ExecutionEnvironment.Encoded } = {
      process_id: processId,
      command,
    };

    if (submission.environment !== undefined) {
      native.environment = Schema.encodeSync(ExecutionEnvironment)(submission.environment);
    }

    const origin = { ...session, workId, generation, actionId: processId };

    const result = await stub.startProcess({ generation, origin, runId, toolCallId, request: native });

    if ('_tag' in result && result._tag === 'ExecutionReused') {
      return Response.json(result, { status: HttpStatusCode.Conflict });
    }

    return Response.json(result);
  }

  if (group === 'browser') {
    const requestId = Schema.decodeUnknownSync(BrowserRequestId)(id);
    const sessionId = SessionId.make(internalRecordId(session.sessionId));
    const body = await readBody(request);
    const decoded = Schema.decodeUnknownSync(BrowserAction, { onExcessProperty: 'error' })(body);
    const encoded = Schema.encodeSync(BrowserAction)(decoded);

    const origin = { ...session, workId, generation, actionId: requestId };

    const result = await stub.runInstalledBrowser({
      generation,
      origin,
      runId,
      toolCallId,
      sessionId,
      request: { requestId, action: encoded },
    });

    if ('_tag' in result) {
      return Response.json(result, { status: HttpStatusCode.Conflict });
    }

    return Response.json(result);
  }

  if (group === 'evidence' && action === 'export' && request.method === HttpMethod.Post) {
    const artifactId = Schema.decodeUnknownSync(EvidenceArtifactId)(id);

    return Response.json(await stub.exportEvidence({ generation, artifactId }));
  }

  return missing();
}
