import { Schema } from 'effect';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCommand } from './process.ts';
import type { Environment } from './types.ts';

type ProcessStatusInput = {
  readonly directory: string;
  readonly environment: Environment;
  readonly signal: AbortSignal;
};

type OwnershipRecord = { readonly source: string; readonly contents: string };

const ProcessOwner = Schema.fromJsonString(
  Schema.Struct({
    workerPid: Schema.optionalKey(Schema.Number),
    childGroups: Schema.optionalKey(Schema.Array(Schema.Struct({ pid: Schema.Number }))),
  }),
);

const OWNERSHIP_FILES: ReadonlySet<string> = new Set(['supervisor.json', 'containers.json']);

export async function captureProcessStatus({ directory, environment, signal }: ProcessStatusInput): Promise<string> {
  const sources = [join(directory, 'owner.json'), join(directory, 'console', 'supervisor.json')];
  const owners: Array<OwnershipRecord> = [];

  for (const host of ['application', 'sandbox']) {
    const privateDirectory = join(directory, host, '.celld');

    const files = await readdir(privateDirectory).catch((cause: unknown) => {
      if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
        return [];
      }

      throw cause;
    });

    const ownershipFiles = files.filter(isOwnershipFile);
    const ownershipPaths = ownershipFiles.map((file) => join(privateDirectory, file));

    sources.push(...ownershipPaths);
  }

  for (const source of sources) {
    const contents = await readFile(source, { encoding: 'utf8', signal }).catch((cause: unknown) => {
      if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
        return null;
      }

      throw cause;
    });

    if (contents !== null) {
      owners.push({ source, contents });
    }
  }

  const supervisors = owners.filter((owner) => owner.source.endsWith('/supervisor.json'));
  const supervisedProcessIds = supervisors.flatMap(ownedProcessIds);
  const processIds = new Set([process.pid, ...supervisedProcessIds]);

  const processes = await runCommand({
    command: 'ps',
    args: ['-p', [...processIds].join(','), '-o', 'pid=,ppid=,pgid=,stat=,lstart=,comm='],
    environment,
    signal,
  });

  return JSON.stringify({ capturedAt: new Date().toISOString(), owners, processes });
}

function isOwnershipFile(file: string): boolean {
  return OWNERSHIP_FILES.has(file) || /^exit-\d+\.json$/.test(file);
}

function ownedProcessIds({ contents }: OwnershipRecord): ReadonlyArray<number> {
  const owner = Schema.decodeUnknownSync(ProcessOwner)(contents);
  const children = owner.childGroups ?? [];
  const childProcessIds = children.map((child) => child.pid);

  if (owner.workerPid === undefined) {
    return childProcessIds;
  }

  return [owner.workerPid, ...childProcessIds];
}
