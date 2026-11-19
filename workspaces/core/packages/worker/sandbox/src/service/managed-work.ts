import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { ManagedSandboxWorkAction, ManagedWorkerAllocation, ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { boundManagedSandbox, InstalledSession } from './managed-sandbox.ts';
import { readBody } from './read-body.ts';
import type { SandboxServiceEnvironment } from './settings.ts';

const AllocationFields = { ...ManagedWorkerAllocation.fields, ...InstalledSession.fields } as const;
const MANAGED_WORK_METHODS: ReadonlySet<string> = new Set([HttpMethod.Post, HttpMethod.Delete]);

const Action = Schema.Union([
  Schema.Struct({
    ...AllocationFields,
    ...ManagedWorkerClaim.fields,
    action: Schema.Literal(ManagedSandboxWorkAction.Start),
  }),
  Schema.Struct({
    ...AllocationFields,
    action: Schema.Literals([ManagedSandboxWorkAction.Touch, ManagedSandboxWorkAction.Release]),
  }),
]);

type LaunchInput = { readonly request: Request; readonly environment: SandboxServiceEnvironment };

export async function serveManagedWork({ request, environment }: LaunchInput): Promise<Response> {
  if (!MANAGED_WORK_METHODS.has(request.method)) {
    return new Response(null, { status: HttpStatusCode.MethodNotAllowed });
  }

  const body = await readBody(request);

  if (request.method === HttpMethod.Delete) {
    const session = Schema.decodeUnknownSync(InstalledSession, { onExcessProperty: 'error' })(body);
    const { stub } = await boundManagedSandbox({ environment, session });

    return new Response(null, { status: await stub.managedDestroy() });
  }

  const command = Schema.decodeUnknownSync(Action, { onExcessProperty: 'error' })(body);
  const { stub } = await boundManagedSandbox({ environment, session: command });
  const { generation } = command;

  switch (command.action) {
    case ManagedSandboxWorkAction.Start: {
      const claim = Schema.decodeUnknownSync(ManagedWorkerClaim)(command);

      return new Response(null, { status: await stub.managedStart({ generation, claim }) });
    }
    case ManagedSandboxWorkAction.Touch:
      return new Response(null, { status: await stub.managedTouch({ generation }) });
    case ManagedSandboxWorkAction.Release:
      return new Response(null, { status: await stub.managedRelease({ generation }) });
  }
}
