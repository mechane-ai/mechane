import { PrivateMode } from '@mechane/program';
import { GUEST_VARIABLES, GuestListening, GuestStart, HostMachineStatus } from '@mechane/sandbox-wire';
import type { HostMachine } from '@mechane/sandbox-wire';
import { Effect, MutableRef, Option, Schema } from 'effect';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { GUEST_BUNDLE, LOOPBACK_HOST } from '../constants.ts';
import { killProcessGroup } from '../processes/kill-process-group.ts';
import { stopProcessGroup } from '../processes/stop-process-group.ts';
import type { StackSettings } from '../types.ts';
import type { HostMachines, ReportInput } from './types.ts';

type HostMachinesInput = { readonly settings: StackSettings; readonly sandboxesFolder: string };

/** The parts of a host machine's folder: the home its executions start in, and its guest's log. */
const MACHINE_FOLDER = { home: 'home', log: 'guest.log' } as const;

/** The port a host guest is told to listen on: 0, so the system picks a free one, which the guest reports. */
const ANY_PORT = '0';

type StartMachineInput = ReportInput & HostMachinesInput;

/** A machine the launcher started: its guest's process, and its state, which the process's events move on. */
type HostMachineRun = { readonly child: ChildProcess; readonly machine: MutableRef.MutableRef<HostMachine> };

/**
 * The machines the launcher started, by id. Each id starts once and never again, so a guest never restarts on its
 * machine, which is what lets an execution's id run once. A report of a known id only reads its state.
 */
export function hostMachines({ settings, sandboxesFolder }: HostMachinesInput): HostMachines {
  const runs = new Map<string, HostMachineRun>();

  const report: HostMachines['report'] = ({ machineId, environment }) => {
    const known = Option.fromNullishOr(runs.get(machineId));

    if (Option.isSome(known)) {
      return MutableRef.get(known.value.machine);
    }

    const run = startMachine({ machineId, environment, settings, sandboxesFolder });

    runs.set(machineId, run);

    return MutableRef.get(run.machine);
  };

  const stop: HostMachines['stop'] = ({ machineId }) => {
    const known = Option.fromNullishOr(runs.get(machineId));

    if (Option.isSome(known)) {
      known.value.child.kill('SIGTERM');
    }
  };

  const stopEach = Effect.fn('stopEach')(function* (): Effect.fn.Return<void> {
    const stopRun: (run: HostMachineRun) => Effect.Effect<void> = ({ child }) => {
      const kill = killProcessGroup({ child });

      return stopProcessGroup({ child, kill });
    };

    yield* Effect.forEach(runs.values(), stopRun, { concurrency: 'unbounded', discard: true });
  });

  return { report, stop, stopEach };
}

/**
 * Starts the guest bundle a container's image copies under `node`, in the machine's own home, which starts empty as a
 * container's disk does. It passes exactly the variables its start named, `PATH`, a loopback host and any free port.
 * The machine runs once its guest writes the port it listens on, and ends when the guest exits.
 */
function startMachine({ machineId, environment, settings, sandboxesFolder }: StartMachineInput): HostMachineRun {
  const folder = join(sandboxesFolder, machineId);
  const home = join(folder, MACHINE_FOLDER.home);

  mkdirSync(home, { recursive: true, mode: PrivateMode.Folder });

  const log = openSync(join(folder, MACHINE_FOLDER.log), 'a', PrivateMode.File);

  const child = spawn('node', [GUEST_BUNDLE], {
    cwd: home,
    env: {
      ...Schema.encodeSync(GuestStart)(environment),
      PATH: settings.inherited['PATH'],
      [GUEST_VARIABLES.host]: LOOPBACK_HOST,
      [GUEST_VARIABLES.port]: ANY_PORT,
    },
    detached: true,
    stdio: ['ignore', 'pipe', log],
  });

  const run: HostMachineRun = { child, machine: MutableRef.make<HostMachine>({ state: HostMachineStatus.Starting }) };

  const listening: (line: string) => void = (line) => {
    const { port } = Schema.decodeUnknownSync(Schema.fromJsonString(GuestListening))(line);

    MutableRef.set(run.machine, { state: HostMachineStatus.Running, port });
  };

  closeSync(log);
  // The guest's standard output is a pipe the spawn opened, which only a spawn that failed lacks.
  createInterface({ input: Option.getOrThrow(Option.fromNullishOr(child.stdout)) }).once('line', listening);
  child.once('exit', () => MutableRef.set(run.machine, { state: HostMachineStatus.Exited }));

  return run;
}
