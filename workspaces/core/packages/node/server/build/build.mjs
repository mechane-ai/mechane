import { RELEASE } from '@mechane/protocol';
import { StandaloneBuilder, WORKFLOW_OPTIONAL_TYPESCRIPT_ALIAS } from '@workflow/builders';
import { Record, Schema } from 'effect';
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { writeDependencyNotices } from './licenses.mjs';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const coreDirectory = resolve(packageDirectory, '../../..');
const runtimeDirectory = resolve(packageDirectory, '../runtime');
const outputDirectory = join(packageDirectory, '.output');
const execute = promisify(execFile);
const requireBanner = [
  "import { createRequire as createMechaneRequire } from 'node:module';",
  'const require = createMechaneRequire(import.meta.url);',
].join('\n');
const WorkflowRegistrations = Schema.Struct({
  workflows: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Struct({ workflowId: Schema.String }))),
});

async function compileWorkflow() {
  /** @type {Set<string>} */
  const inputs = new Set();
  const builder = new StandaloneBuilder({
    buildTarget: 'standalone',
    workingDir: runtimeDirectory,
    projectRoot: coreDirectory,
    moduleSpecifierRoot: coreDirectory,
    dirs: ['src'],
    stepsBundlePath: join(outputDirectory, 'workflow/steps.mjs'),
    workflowsBundlePath: join(outputDirectory, 'workflow/flow.mjs'),
    webhookBundlePath: join(outputDirectory, 'workflow/webhook.mjs'),
    sourcemap: false,
    onAfterTransform({ absolutePath }) {
      inputs.add(absolutePath);
    },
  });

  await builder.build();

  const generatedManifest = join(runtimeDirectory, '.well-known/workflow/v1/manifest.json');
  const manifest = Schema.decodeUnknownSync(WorkflowRegistrations)(
    JSON.parse(await readFile(generatedManifest, 'utf8')),
  );
  const workflows = Record.values(manifest.workflows).flatMap(Record.keys);
  const executionWorkflows = workflows.filter((name) => name === 'runWorkflow');

  if (executionWorkflows.length !== 1) {
    throw new Error('Workflow compilation must register exactly one runWorkflow entry');
  }

  await cp(generatedManifest, join(outputDirectory, 'workflow/manifest.json'));
  await rm(join(outputDirectory, 'workflow/steps.mjs'));
  await rm(join(outputDirectory, 'workflow/webhook.mjs'));
  await rm(join(outputDirectory, 'workflow/steps.mjs.debug.json'), { force: true });
  await rm(join(outputDirectory, 'workflow/flow.mjs.__wf_tmp.js.debug.json'), { force: true });

  return [...inputs];
}

/** @param {{ entry: string; output: string }} input Program source and its standalone output path. */
async function bundleProgram({ entry, output }) {
  return await build({
    absWorkingDir: coreDirectory,
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: false,
    legalComments: 'linked',
    metafile: true,
    alias: { typescript: WORKFLOW_OPTIONAL_TYPESCRIPT_ALIAS },
    banner: { js: requireBanner },
    external: ['pg-native', 'cbor-extract'],
    logLevel: 'info',
  });
}

async function compilePrograms() {
  const workflowBootstrap = import.meta.resolve('@workflow/world-postgres/cli');
  const bootstrapOutput = join(outputDirectory, 'workflow/bootstrap/dist/cli.mjs');
  const bootstrapBundle = join(dirname(bootstrapOutput), 'bootstrap.mjs');
  const migrationSource = fileURLToPath(new URL('../src/drizzle/migrations/', workflowBootstrap));
  const migrationOutput = join(dirname(bootstrapOutput), '../src/drizzle/migrations');

  const server = await bundleProgram({
    entry: join(packageDirectory, 'src/main.ts'),
    output: join(outputDirectory, 'server.mjs'),
  });
  const migration = await bundleProgram({
    entry: join(packageDirectory, 'src/migrate/main.ts'),
    output: join(outputDirectory, 'migrate.mjs'),
  });
  const grant = await bundleProgram({
    entry: join(packageDirectory, 'src/grant/main.ts'),
    output: join(outputDirectory, 'grant.mjs'),
  });
  const bootstrap = await bundleProgram({ entry: fileURLToPath(workflowBootstrap), output: bootstrapBundle });
  await writeFile(bootstrapOutput, "import { setupDatabase } from './bootstrap.mjs';\nawait setupDatabase();\n");
  await cp(migrationSource, migrationOutput, { recursive: true, dereference: true });

  return [server, migration, grant, bootstrap].flatMap(({ metafile }) => Record.keys(metafile.inputs));
}

async function main() {
  const { stdout } = await execute('git', ['rev-parse', '--verify', 'HEAD'], { cwd: coreDirectory, encoding: 'utf8' });
  const revision = stdout.trim();

  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision)) {
    throw new Error('Release revision must be a Git commit identity');
  }

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const workflowInputs = await compileWorkflow();
  const programInputs = await compilePrograms();

  await writeDependencyNotices({
    inputs: [...workflowInputs, ...programInputs],
    workingDirectory: coreDirectory,
    outputPath: join(outputDirectory, 'THIRD_PARTY_LICENSES.txt'),
  });

  const consoleDirectory = join(coreDirectory, 'packages/browser/console/dist/client');
  const consoleOutput = join(outputDirectory, 'public/console');

  await cp(consoleDirectory, consoleOutput, { recursive: true, dereference: true });
  await writeFile(join(outputDirectory, 'release.json'), `${JSON.stringify({ version: RELEASE, revision })}\n`);
}

await main();
