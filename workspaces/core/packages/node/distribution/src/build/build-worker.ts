import { applicationWorkerDeployment, SANDBOX_VARIABLES, SandboxProvider } from '@mechane/deployment';
import { JSON_INDENT_CHARS } from '@mechane/program';
import { RELEASE } from '@mechane/protocol';
import { MediaType } from '@mechane/records';
import { workerBuildOptions } from '@mechane/wrangler';
import { Record } from 'effect';
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { CORE_FOLDER, SOURCE_FOLDER } from '../constants.ts';
import { RUNTIME_OUTPUT_FOLDER } from '../runtime-artifact.ts';
import type { RuntimeBuild } from '../runtime-artifact.ts';
import { writeDependencyNotices } from './dependency-notices.ts';

const packageDirectory = resolve(CORE_FOLDER, 'packages/worker/server');
const outputDirectory = RUNTIME_OUTPUT_FOLDER;
const execute = promisify(execFile);

const requireBanner = [
  "import { createRequire as createMechaneRequire } from 'node:module';",
  'const require = createMechaneRequire(import.meta.url);',
].join('\n');

const REQUIRED_EXPORTS = ['default', 'MechObject', 'SandboxObject', 'MachineObject', 'EgressGateway'] as const;
const SOURCE_TIMEOUT_MS = 10_000;

async function writeWorkerConfiguration(): Promise<void> {
  const configuration = applicationWorkerDeployment({
    name: 'mechane',
    entry: '.output/worker.js',
    assetsDirectory: '.output/console',
    sandbox: { image: '../../node/guest/image/Dockerfile', bucketName: 'mechane-local-sandbox-files' },
    variables: {
      [SANDBOX_VARIABLES.sandboxProvider]: SandboxProvider.Container,
      [SANDBOX_VARIABLES.sandboxHosts]: '[]',
    },
  });

  await writeFile(
    join(packageDirectory, 'wrangler.jsonc'),
    `${JSON.stringify(configuration, undefined, JSON_INDENT_CHARS)}\n`,
  );
}

type BundleCommandInput = { readonly entry: string; readonly output: string };

async function bundleCommand({ entry, output }: BundleCommandInput) {
  return await build({
    absWorkingDir: CORE_FOLDER,
    entryPoints: [join(packageDirectory, entry)],
    outfile: join(outputDirectory, output),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: false,
    legalComments: 'linked',
    metafile: true,
    banner: { js: requireBanner },
    external: ['pg-native', 'cbor-extract'],
    logLevel: 'info',
  });
}

async function main(): Promise<void> {
  const { stdout } = await execute('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: CORE_FOLDER,
    encoding: 'utf8',
    timeout: SOURCE_TIMEOUT_MS,
  });

  const revision = stdout.trim();

  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision)) {
    throw new Error('Release revision must be a Git commit identity');
  }

  const toolConfiguration = await readFile(join(SOURCE_FOLDER, 'mise.toml'), 'utf8');
  const nodeVersion = /^node = "(\d+\.\d+\.\d+)"$/m.exec(toolConfiguration)?.[1];

  if (nodeVersion === undefined) {
    throw new Error('Release operations require one exact pinned Node version');
  }

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const worker = await build({
    ...workerBuildOptions(),
    absWorkingDir: CORE_FOLDER,
    entryPoints: [join(packageDirectory, 'src/main.ts')],
    outfile: join(outputDirectory, 'worker.js'),
    bundle: true,
    format: 'esm',
    sourcemap: false,
    legalComments: 'linked',
    metafile: true,
    define: { 'import.meta.mechaneRevision': JSON.stringify(revision) },
    logLevel: 'info',
  });

  const workerOutput = Record.values(worker.metafile.outputs).find((output) => output.entryPoint !== undefined);

  if (workerOutput === undefined || !REQUIRED_EXPORTS.every((name) => workerOutput.exports.includes(name))) {
    throw new Error(
      'Worker must export its fetch handler, MechObject, SandboxObject, MachineObject, and EgressGateway',
    );
  }

  const migration = await bundleCommand({ entry: 'src/migrate/main.ts', output: 'migrate.mjs' });
  const grant = await bundleCommand({ entry: 'src/grant/main.ts', output: 'grant.mjs' });
  const historicalImport = await bundleCommand({ entry: 'src/import/main.ts', output: 'import.mjs' });
  const inputs = [worker, migration, grant, historicalImport].flatMap(({ metafile }) => Record.keys(metafile.inputs));

  await writeDependencyNotices({
    inputs,
    workingDirectory: CORE_FOLDER,
    outputPath: join(outputDirectory, 'THIRD_PARTY_LICENSES.txt'),
  });

  await cp(join(CORE_FOLDER, 'packages/browser/console/dist/client'), join(outputDirectory, 'console'), {
    recursive: true,
    dereference: true,
  });

  const metadata: RuntimeBuild = {
    version: RELEASE,
    revision,
    node_version: nodeVersion,
    worker_modules: [{ path: 'worker.js', content_type: MediaType.JavaScriptModule }],
  };

  await writeFile(join(outputDirectory, 'build.json'), `${JSON.stringify(metadata)}\n`);
  await writeWorkerConfiguration();
}

await main();
