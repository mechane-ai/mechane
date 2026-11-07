import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { GUEST_VARIABLES, GuestListening, GuestStart, HostMachineStart } from '@mechane/sandbox-wire';
import type { HostMachine } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { startHttpService } from '../fixtures/http.ts';
import type { HttpService } from '../fixtures/http.ts';
import type { Environment } from '../types.ts';
import { signalProcessGroup } from './process-group.ts';

const PROCESS_STOP_MS = 5000;
const PRIVATE_LOG_MODE = 0o600;

type HostLauncherOptions = {
  readonly directory: string;
  readonly guestEntry: string;
  readonly bearer: string;
  readonly environment: Environment;
  readonly nodeExecutable: string;
};

type Machine = { readonly child: ChildProcess; readonly exited: Promise<void>; readonly status: HostMachine };

export async function startHostLauncher(input: HostLauncherOptions): Promise<HttpService> {
  const machines = new Map<string, Promise<Machine>>();

  async function handle(request: Request): Promise<Response> {
    if (request.headers.get(HttpHeader.Authorization) !== `Bearer ${input.bearer}`) {
      return new Response(null, { status: HttpStatusCode.Unauthorized });
    }

    const match = /^\/machines\/([\da-f-]{36})$/iu.exec(new URL(request.url).pathname);
    const id = match?.[1];

    if (id === undefined) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    const current = machines.get(id);

    if (request.method === HttpMethod.Get) {
      const machine = await current;

      return Response.json(machine?.status ?? { state: 'exited' });
    }

    if (request.method === HttpMethod.Delete) {
      if (current !== undefined) {
        await stopMachine(await current);
      }

      return new Response(null, { status: HttpStatusCode.NoContent });
    }

    if (request.method !== HttpMethod.Put) {
      return new Response(null, { status: HttpStatusCode.MethodNotAllowed });
    }

    if (current !== undefined) {
      const machine = await current;

      return Response.json(machine.status);
    }

    const decoded = Schema.decodeUnknownSync(HostMachineStart)(await request.json());

    if (decoded.environment.machineId !== id) {
      return new Response(null, { status: HttpStatusCode.BadRequest });
    }

    const existing = machines.get(id);

    if (existing !== undefined) {
      const machine = await existing;

      return Response.json(machine.status);
    }

    const starting = startMachine(input, id, decoded.environment);

    machines.set(id, starting);

    const machine = await starting;

    return Response.json(machine.status);
  }

  const service = await startHttpService(handle);

  return {
    origin: service.origin,
    close: async () => {
      const serviceOutcomes = await Promise.allSettled([service.close()]);

      const machineOutcomes = await Promise.allSettled(
        [...machines.values()].map(async (machine) => await stopMachine(await machine)),
      );

      const outcomes = [...serviceOutcomes, ...machineOutcomes];
      const failures = outcomes.filter((outcome) => outcome.status === 'rejected');

      if (failures.length > 0) {
        throw new AggregateError(
          failures.map((failure): unknown => failure.reason),
          'Could not stop every fixture guest',
        );
      }
    },
  };
}

async function startMachine(
  input: HostLauncherOptions,
  id: string,
  environment: typeof GuestStart.Type,
): Promise<Machine> {
  const folder = join(input.directory, id);
  const home = join(folder, 'home');

  await mkdir(home, { recursive: true, mode: 0o700 });

  const log = await open(join(folder, 'guest.log'), 'a', PRIVATE_LOG_MODE);

  const child = spawn(input.nodeExecutable, [input.guestEntry], {
    cwd: home,
    env: {
      ...Schema.encodeSync(GuestStart)(environment),
      PATH: input.environment['PATH'],
      [GUEST_VARIABLES.host]: '127.0.0.1',
      [GUEST_VARIABLES.port]: '0',
    },
    detached: true,
    stdio: ['ignore', 'pipe', log.fd],
  });

  await log.close();

  const exited = new Promise<void>((resolve, reject) => {
    child.once('exit', () => resolve());
    child.once('error', reject);
  });

  const machine: { readonly child: ChildProcess; readonly exited: Promise<void>; status: HostMachine } = {
    child,
    exited,
    status: { state: 'starting' },
  };

  child.once('exit', () => {
    machine.status = { state: 'exited' };
  });

  if (child.stdout === null) {
    await stopMachine(machine);

    throw new Error('The fixture guest has no readiness output');
  }

  const lines = createInterface({ input: child.stdout });

  lines.once('line', (line) => {
    const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(GuestListening))(line);

    if (decoded._tag === 'Failure') {
      child.kill('SIGTERM');

      machine.status = { state: 'exited' };

      return;
    }

    machine.status = { state: 'running', port: decoded.success.port };
  });

  return machine;
}

async function stopMachine(machine: Machine): Promise<void> {
  if (machine.child.exitCode !== null || machine.child.signalCode !== null) {
    signalProcessGroup({ child: machine.child, signal: 'SIGKILL' });
    await machine.exited;

    return;
  }

  signalProcessGroup({ child: machine.child, signal: 'SIGTERM' });

  const timeout = setTimeout(() => {
    signalProcessGroup({ child: machine.child, signal: 'SIGKILL' });
  }, PROCESS_STOP_MS);

  try {
    await machine.exited;
  } finally {
    clearTimeout(timeout);
    signalProcessGroup({ child: machine.child, signal: 'SIGKILL' });
  }
}
