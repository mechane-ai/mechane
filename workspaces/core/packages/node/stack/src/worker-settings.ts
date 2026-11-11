import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CelldWorkerOptions } from './celld/types.ts';
import type { CelldBinary, LocalCli } from './types.ts';

const DEFAULT_WORKER_ENTRY = fileURLToPath(new URL('../../../worker/server/src/main.ts', import.meta.url));

const DEFAULT_WORKER_ARTIFACT = fileURLToPath(new URL('../../../worker/server/.output/worker.js', import.meta.url));

export const DEFAULT_GUEST_IMAGE = fileURLToPath(new URL('../../guest/image/Dockerfile', import.meta.url));
const DEFAULT_CONSOLE_ASSETS = fileURLToPath(new URL('../../../browser/console/dist/client', import.meta.url));
const SOURCE_CLI_ENTRY = fileURLToPath(new URL('../../cli/src/main.ts', import.meta.url));

type SourceInput = { readonly isSource: boolean };
type LocationsInput = SourceInput & { readonly suppliedEntry: string; readonly artifactDirectory: string };
type DatabaseProgramInput = SourceInput & { readonly directory: string; readonly name: string };
type BinaryOptionsInput = { readonly binary: CelldBinary | undefined };
type CliOptionsInput = SourceInput & { readonly cli: LocalCli | undefined };

export function localCli({ isSource, cli }: CliOptionsInput): LocalCli {
  if (cli !== undefined) {
    return cli;
  }

  if (isSource) {
    return { command: 'bun', args: [SOURCE_CLI_ENTRY] };
  }

  throw new Error('Artifact mode requires its explicitly selected candidate CLI');
}

export function defaultWorkerEntry({ isSource }: SourceInput): string {
  if (isSource) {
    return DEFAULT_WORKER_ENTRY;
  }

  return DEFAULT_WORKER_ARTIFACT;
}

export function workerLocations({ isSource, suppliedEntry, artifactDirectory }: LocationsInput) {
  if (isSource) {
    return { entry: suppliedEntry, assets: DEFAULT_CONSOLE_ASSETS };
  }

  const entry = join(artifactDirectory, 'worker.js');

  return { entry, assets: join(artifactDirectory, 'console') };
}

export function databaseProgramPath({ isSource, directory, name }: DatabaseProgramInput): string {
  if (isSource) {
    return join(directory, name, 'main.ts');
  }

  return join(directory, `${name}.mjs`);
}

export function workerBinaryOptions({ binary }: BinaryOptionsInput): Pick<CelldWorkerOptions, 'celldBinary'> {
  if (binary === undefined) {
    return {};
  }

  return { celldBinary: binary };
}
