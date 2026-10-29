import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect, Option } from 'effect';
import { readdir } from 'node:fs/promises';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import type { ContainerProcess } from './container-process.schemas.ts';
import { readContainerProcess } from './read-container-process.ts';

type GuestAncestorInput = { readonly processId: number; readonly processes: ReadonlyArray<ContainerProcess> };

/** Finds live processes of the guest user outside the trusted guest ancestor chain. */
export const liveContainerProcesses = Effect.fn('liveContainerProcesses')(function* ({
  generation,
}: WorkspaceFilesInput): Effect.fn.Return<ReadonlyArray<ContainerProcess>, WorkspaceFailed> {
  const names = yield* Effect.tryPromise({
    try: () => readdir('/proc'),
    catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: String(cause) }),
  });

  const identifiers = names.filter((name) => /^[0-9]+$/.test(name));

  const readProcess: (directory: string) => ReturnType<typeof readContainerProcess> = (directory) =>
    readContainerProcess({ generation, directory });

  const found = yield* Effect.forEach(identifiers, readProcess, { concurrency: 1 });
  const processes = found.flatMap(Option.toArray);
  const current = processes.find((candidate) => candidate.Pid === process.pid);
  const self = Option.fromNullishOr(current);

  if (Option.isNone(self)) {
    return yield* new WorkspaceFailed({
      generation,
      step: WorkspaceStep.Archive,
      reason: 'guest is absent from its container process namespace',
    });
  }

  const user = self.value.Uid.split(/\s+/)[0];

  const isCommandProcess: (candidate: ContainerProcess) => boolean = (candidate) => {
    const isAlive = !candidate.State.startsWith('Z') && !candidate.State.startsWith('X');

    return (
      isAlive && candidate.Uid.split(/\s+/)[0] === user && !isGuestAncestor({ processId: candidate.Pid, processes })
    );
  };

  return processes.filter(isCommandProcess);
});

/** An injected init and the guest itself are trusted; every other process of the guest user belongs to commands. */
function isGuestAncestor({ processId, processes }: GuestAncestorInput): boolean {
  const self = processes.find((candidate) => candidate.Pid === process.pid);

  for (let current = Option.fromNullishOr(self); Option.isSome(current);) {
    if (current.value.Pid === processId) {
      return true;
    }

    const parentId = current.value.PPid;
    const parent = processes.find((candidate) => candidate.Pid === parentId);

    current = Option.fromNullishOr(parent);
  }

  return false;
}
