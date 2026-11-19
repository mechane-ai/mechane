import type { ControlStore } from '@mechane/control-store';
import { HttpStatusCode } from '@mechane/records';
import {
  ExecutionEnvironmentRequired,
  InstalledProcessCommand,
  InstalledProcessSubmission,
} from '@mechane/sandbox-wire';
import { Result, Schema } from 'effect';
import { readJsonBody } from '../http/body.ts';
import { ManagedHttpError } from './http-error.ts';
import { workerBearer } from './work-auth.ts';

type Start = {
  readonly store: ControlStore;
  readonly request: Request;
  readonly sessionId: string;
  readonly submit: (body: string) => Promise<Response>;
};

export async function startInstalledProcess({ store, request, sessionId, submit }: Start): Promise<Response> {
  const body = await readJsonBody(request);
  const command = Schema.decodeUnknownResult(InstalledProcessCommand, { onExcessProperty: 'error' })(body);

  if (Result.isFailure(command)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Expected a process command');
  }

  const current = await submit(JSON.stringify(command.success));

  if (!current.ok) {
    return current;
  }

  const receipt: unknown = await current.json();

  if (!Schema.is(ExecutionEnvironmentRequired)(receipt)) {
    return Response.json(receipt, { status: current.status });
  }

  const { environment } = await store.managed.installed.commandAccess.resolve({
    sessionId,
    token: workerBearer(request),
  });

  const submission = Schema.encodeSync(Schema.fromJsonString(InstalledProcessSubmission))({
    ...command.success,
    environment,
  });

  return await submit(submission);
}
