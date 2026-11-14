import { CliTarget, releaseBinaryName } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { arch, homedir, platform, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CORE_FOLDER, SOURCE_FOLDER } from '../constants.ts';
import { fileDigest } from '../files/file-digest.ts';
import { runCommand } from '../files/run-command.ts';
import type { RuntimeRelease } from '../runtime-artifact.ts';
import type { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionSettings, FileDigest } from '../types.ts';

const SUMMARY_PREFIX = 'SMOKE_CATALOG_SUMMARY ';

const CatalogSummary = Schema.Struct({
  count: Schema.Int.check(Schema.isGreaterThan(0)),
  guarantees: Schema.Array(Schema.NonEmptyString),
  stackCount: Schema.Int.check(Schema.isGreaterThan(0)),
  stackInspections: Schema.Array(Schema.NonEmptyString),
  executions: Schema.Array(
    Schema.Struct({
      stack: Schema.Int.check(Schema.isGreaterThan(0)),
      guarantee: Schema.NonEmptyString,
      elapsedMs: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    }),
  ),
});

const DockerImage = Schema.Struct({
  Id: Schema.NonEmptyString,
  Os: Schema.Literal('linux'),
  Architecture: Schema.Literal('amd64'),
  Descriptor: Schema.Struct({ digest: Schema.NonEmptyString }),
});

type CandidateChecksInput = {
  readonly settings: DistributionSettings;
  readonly receipt: ArtifactReceipt;
  readonly manifest: InstallationManifest;
  readonly release: RuntimeRelease;
};

export type CandidateChecks = {
  readonly logs: ReadonlyArray<{ readonly name: string; readonly contents: string }>;
  readonly catalog: typeof CatalogSummary.Type;
  readonly guestImage: string;
  readonly cli: string;
  readonly tools: {
    readonly node: FileDigest & { readonly version: string };
    readonly celld: FileDigest & { readonly version: string };
  };
};

/** Exercises the built bytes through the same native stack and catalog used during development. */
export async function runCandidateChecks({
  settings,
  receipt,
  manifest,
  release,
}: CandidateChecksInput): Promise<CandidateChecks> {
  const temporary = await mkdtemp(join(tmpdir(), 'mechane-candidate-'));
  const logs: Array<{ readonly name: string; readonly contents: string }> = [];

  async function execute(command: string, args: ReadonlyArray<string>): Promise<string> {
    return await Effect.runPromise(runCommand({ command, args, settings }));
  }

  function retain(name: string, contents: string): void {
    const portable = contents
      .replaceAll(temporary, '/candidate-workspace')
      .replaceAll(resolve(SOURCE_FOLDER), '/source')
      .replaceAll(homedir(), '/operator-home');

    logs.push({ name, contents: portable });
  }

  try {
    const staticLog = await execute('mise', ['-C', CORE_FOLDER, 'run', 'check:static', ':::', 'infrastructure:verify']);

    retain('qualification-static.log', staticLog);

    await execute('mise', ['-C', CORE_FOLDER, 'run', 'browser:install']);

    const celldLocation = await execute('mise', ['-C', SOURCE_FOLDER, 'which', 'celld']);
    const celldPath = celldLocation.trim();
    const celld = await Effect.runPromise(fileDigest({ path: celldPath }));
    const celldOutput = await execute(celldPath, ['--version']);
    const celldVersion = celldOutput.trim();
    const node = await Effect.runPromise(fileDigest({ path: settings.nodeExecutable }));

    const module = join(temporary, 'module');

    await execute('unzip', ['-q', join(settings.folder, release.runtime.archive), '-d', module]);

    await verifyRuntimeFiles({ module, manifest });

    const guest = receipt.assets.find(
      (asset) => asset.sha256 === manifest.guest.sha256 && asset.bytes === manifest.guest.bytes,
    );

    if (guest === undefined) {
      throw new Error('The candidate guest archive is missing');
    }

    const loaded = await execute('docker', ['load', '--input', join(settings.folder, guest.name)]);

    retain('qualification-guest-load.log', loaded);

    const images = await execute('docker', ['image', 'inspect', manifest.guest.digest]);
    const [image] = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(DockerImage)))(images);

    if (image === undefined || image.Descriptor.digest !== manifest.guest.digest) {
      throw new Error('Docker did not load the selected guest OCI manifest');
    }

    const target = Schema.decodeUnknownSync(Schema.Enum(CliTarget))(`${platform()}-${arch()}`);
    const cli = releaseBinaryName({ target });
    const binary = receipt.assets.find(({ name }) => name === cli);

    if (binary === undefined) {
      throw new Error('The candidate has no CLI for this qualification host');
    }

    const smoke = await execute(settings.nodeExecutable, [
      join(CORE_FOLDER, 'packages/node/smoke/src/main.ts'),
      '--artifact-directory',
      module,
      '--guest-image',
      image.Id,
      '--cli-executable',
      join(settings.folder, cli),
    ]);

    retain('qualification-artifact-scenarios.log', smoke);

    await verifyRuntimeFiles({ module, manifest });

    const currentCelld = await Effect.runPromise(fileDigest({ path: celldPath }));
    const currentNode = await Effect.runPromise(fileDigest({ path: settings.nodeExecutable }));

    if (currentCelld.sha256 !== celld.sha256 || currentNode.sha256 !== node.sha256) {
      throw new Error('Qualification tools changed during the artifact catalog');
    }

    const summary = smoke.split('\n').find((line) => line.startsWith(SUMMARY_PREFIX));

    if (summary === undefined) {
      throw new Error('The complete artifact catalog did not report success');
    }

    const catalog = Schema.decodeUnknownSync(Schema.fromJsonString(CatalogSummary))(
      summary.slice(SUMMARY_PREFIX.length),
    );

    if (catalog.count !== catalog.guarantees.length || new Set(catalog.guarantees).size !== catalog.count) {
      throw new Error('The artifact catalog summary is incomplete');
    }

    verifyCatalogExecutions({ catalog });

    const formats = await execute(settings.nodeExecutable, [
      join(CORE_FOLDER, 'packages/node/distribution/testing/shipped-formats.ts'),
      join(settings.folder, 'installation.json'),
    ]);

    retain('qualification-shipped-formats.log', formats);

    return {
      logs,
      catalog,
      guestImage: manifest.guest.digest,
      cli,
      tools: { node: { ...node, version: process.versions.node }, celld: { ...celld, version: celldVersion } },
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

type VerifyCatalogExecutionsInput = { readonly catalog: typeof CatalogSummary.Type };

function verifyCatalogExecutions({ catalog }: VerifyCatalogExecutionsInput): void {
  const hasUnknownExecution = catalog.executions.some(
    (execution) => !catalog.guarantees.includes(execution.guarantee) || execution.stack > catalog.stackCount,
  );

  const hasUnknownInspection = catalog.stackInspections.some((guarantee) => !catalog.guarantees.includes(guarantee));

  if (hasUnknownExecution || hasUnknownInspection) {
    throw new Error('The artifact catalog reports undeclared executions');
  }

  for (const guarantee of catalog.guarantees) {
    const executions = catalog.executions.filter((execution) => execution.guarantee === guarantee);

    const expected: number = (() => {
      if (catalog.stackInspections.includes(guarantee)) {
        return catalog.stackCount;
      }

      return 1;
    })();

    if (executions.length !== expected || new Set(executions.map(({ stack }) => stack)).size !== expected) {
      throw new Error(`The artifact catalog did not inspect every required stack: ${guarantee}`);
    }
  }
}

type VerifyRuntimeInput = { readonly module: string; readonly manifest: InstallationManifest };

async function verifyRuntimeFiles({ module, manifest }: VerifyRuntimeInput): Promise<void> {
  for (const file of manifest.runtime_files) {
    const actual = await Effect.runPromise(fileDigest({ path: join(module, file.path) }));

    if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes) {
      throw new Error('Extracted candidate runtime changed during acceptance');
    }
  }
}
