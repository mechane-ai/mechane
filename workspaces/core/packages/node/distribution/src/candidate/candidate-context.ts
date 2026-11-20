import { CliTarget, releaseBinaryName } from '@mechane/releases';
import { inspectGuestImage } from '@mechane/stack';
import { Effect, Schema } from 'effect';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { arch, homedir, platform, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { qualifyDistribution } from '../build/qualify-distribution.ts';
import { readPublicSource } from '../build/read-public-source.ts';
import { CORE_FOLDER, DistributionStep, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { runCommand } from '../files/run-command.ts';
import type { ArtifactQualification } from '../qualification.ts';
import { RuntimeRelease } from '../runtime-artifact.ts';
import { InstallationManifest } from '../schemas.ts';
import type { ArtifactReceipt } from '../schemas.ts';
import type { DistributionSettings, FileDigest } from '../types.ts';
import { verifyDistribution } from '../verify/verify-distribution.ts';
import { verifyQualifiedDistribution } from '../verify/verify-qualified-distribution.ts';
import type { CandidateChecks, QualificationTools } from './shard-schema.ts';
import { writeAcceptanceEvidence } from './write-acceptance-evidence.ts';

export type VerifiedCandidate = {
  readonly source: string;
  readonly selected: FileDigest;
  readonly receipt: ArtifactReceipt;
  readonly manifest: InstallationManifest;
  readonly release: RuntimeRelease;
};

type VerifyCandidateInput = { readonly settings: DistributionSettings };
type VerifyUnchangedInput = { readonly settings: DistributionSettings; readonly candidate: VerifiedCandidate };
type VerifyRuntimeInput = { readonly module: string; readonly manifest: InstallationManifest };

type ExecuteInput = {
  readonly settings: DistributionSettings;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
};

type SanitizeInput = { readonly contents: string; readonly temporary: string };

type PrepareGuestInput = {
  readonly settings: DistributionSettings;
  readonly receipt: ArtifactReceipt;
  readonly manifest: InstallationManifest;
};

type UnchangedCandidate = { readonly artifacts: FileDigest; readonly installation: FileDigest; readonly tree: string };

type ExtractedModuleInput = { readonly temporary: string; readonly module: string };

type PreparedGuest = { readonly guestImageId: string; readonly guestImageLog: string; readonly cli: string };

type RetainedLog = { readonly name: string; readonly contents: string };

type StaticChecksInput = {
  readonly settings: DistributionSettings;
  readonly module: string;
  readonly temporary: string;
};

type WithModuleInput<T> = {
  readonly settings: DistributionSettings;
  readonly manifest: InstallationManifest;
  readonly release: RuntimeRelease;
  readonly run: (input: ExtractedModuleInput) => Promise<T>;
};

export const existingQualification = Effect.fn('existingQualification')(function* ({
  settings,
}: VerifyCandidateInput): Effect.fn.Return<ArtifactQualification | null, DistributionFailed> {
  const qualificationPath = join(settings.folder, 'qualification.json');

  if (!existsSync(qualificationPath)) {
    return null;
  }

  const qualification = yield* fileDigest({ path: qualificationPath });

  return yield* verifyQualifiedDistribution({ settings: { ...settings, argument: qualification.sha256 } });
});

export const verifyAcceptanceCandidate = Effect.fn('verifyAcceptanceCandidate')(function* ({
  settings,
}: VerifyCandidateInput): Effect.fn.Return<VerifiedCandidate, DistributionFailed> {
  const selected = yield* fileDigest({ path: join(settings.folder, 'artifacts.json') });

  if (selected.sha256 !== settings.argument) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'acceptance requires the explicitly selected artifacts.json SHA-256',
    });
  }

  const source = yield* readPublicSource({ settings });
  const receipt = yield* verifyDistribution({ settings });

  if (receipt.public_commit !== source) {
    return yield* new DistributionFailed({
      step: DistributionStep.Source,
      reason: 'accept this candidate from its source revision',
    });
  }

  const manifest = yield* readDocument({
    path: join(settings.folder, 'installation.json'),
    schema: InstallationManifest,
  });

  const release = yield* readDocument({ path: join(settings.folder, 'release.json'), schema: RuntimeRelease });

  if (release.commands.node_version !== process.versions.node) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'use the candidate pinned Node version',
    });
  }

  return { source, selected, receipt, manifest, release };
});

export const verifyCandidateUnchanged = Effect.fn('verifyCandidateUnchanged')(function* ({
  settings,
  candidate,
}: VerifyUnchangedInput): Effect.fn.Return<UnchangedCandidate, DistributionFailed> {
  yield* verifyDistribution({ settings });

  const unchanged = yield* readPublicSource({ settings });
  const artifacts = yield* fileDigest({ path: join(settings.folder, 'artifacts.json') });

  if (
    unchanged !== candidate.source ||
    artifacts.sha256 !== candidate.selected.sha256 ||
    artifacts.bytes !== candidate.selected.bytes
  ) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'candidate or source changed during acceptance',
    });
  }

  const installation = yield* fileDigest({ path: join(settings.folder, 'installation.json') });
  const tree = yield* runCommand({ command: 'git', args: ['-C', SOURCE_FOLDER, 'rev-parse', 'HEAD^{tree}'], settings });

  return { artifacts, installation, tree };
});

export async function executeDistributionCommand({ settings, command, args }: ExecuteInput): Promise<string> {
  return await Effect.runPromise(runCommand({ command, args, settings }));
}

export function sanitizeCandidateLog({ contents, temporary }: SanitizeInput): string {
  return contents
    .replaceAll(temporary, '/candidate-workspace')
    .replaceAll(resolve(SOURCE_FOLDER), '/source')
    .replaceAll(homedir(), '/operator-home');
}

type SealQualificationInput = {
  readonly settings: DistributionSettings;
  readonly candidate: VerifiedCandidate;
  readonly unchanged: UnchangedCandidate;
  readonly checked: CandidateChecks;
};

export const sealCandidateQualification = Effect.fn('sealCandidateQualification')(function* ({
  settings,
  candidate,
  unchanged,
  checked,
}: SealQualificationInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  const request = yield* Effect.tryPromise({
    try: () =>
      writeAcceptanceEvidence({
        folder: settings.folder,
        source: candidate.source,
        tree: unchanged.tree,
        artifacts: unchanged.artifacts,
        installation: unchanged.installation,
        workerSha256: candidate.manifest.worker.sha256,
        checked,
      }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  return yield* qualifyDistribution({ settings, receipt: candidate.receipt, request });
});

async function verifyRuntimeFiles({ module, manifest }: VerifyRuntimeInput): Promise<void> {
  for (const file of manifest.runtime_files) {
    const actual = await Effect.runPromise(fileDigest({ path: join(module, file.path) }));

    if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes) {
      throw new Error('Extracted candidate runtime changed during acceptance');
    }
  }
}

export async function withExtractedModule<T>({ settings, manifest, release, run }: WithModuleInput<T>): Promise<T> {
  const temporary = await mkdtemp(join(tmpdir(), 'mechane-candidate-'));

  try {
    const module = join(temporary, 'module');

    await executeDistributionCommand({
      settings,
      command: 'unzip',
      args: ['-q', join(settings.folder, release.runtime.archive), '-d', module],
    });
    await verifyRuntimeFiles({ module, manifest });

    const value = await run({ temporary, module });

    await verifyRuntimeFiles({ module, manifest });

    return value;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function inspectQualificationTools({ settings }: VerifyCandidateInput): Promise<QualificationTools> {
  const celldLocation = await executeDistributionCommand({
    settings,
    command: 'mise',
    args: ['-C', SOURCE_FOLDER, 'which', 'celld'],
  });

  const celldPath = celldLocation.trim();
  const celld = await Effect.runPromise(fileDigest({ path: celldPath }));
  const celldOutput = await executeDistributionCommand({ settings, command: celldPath, args: ['--version'] });
  const celldVersion = celldOutput.trim();
  const node = await Effect.runPromise(fileDigest({ path: settings.nodeExecutable }));

  return { node: { ...node, version: process.versions.node }, celld: { ...celld, version: celldVersion } };
}

export async function prepareQualificationGuest({
  settings,
  receipt,
  manifest,
}: PrepareGuestInput): Promise<PreparedGuest> {
  const guest = receipt.assets.find(
    (asset) => asset.sha256 === manifest.guest.sha256 && asset.bytes === manifest.guest.bytes,
  );

  if (guest === undefined) {
    throw new Error('The candidate guest archive is missing');
  }

  const selection = { environment: settings.inherited, digest: manifest.guest.digest };

  const image = await inspectGuestImage(selection).catch(async () => {
    await executeDistributionCommand({
      settings,
      command: 'docker',
      args: ['load', '--input', join(settings.folder, guest.name)],
    });

    return await inspectGuestImage(selection);
  });

  if (image.Architecture !== 'amd64') {
    throw new Error('The candidate must run with its Linux amd64 guest');
  }

  const target = Schema.decodeUnknownSync(Schema.Enum(CliTarget))(`${platform()}-${arch()}`);
  const cli = releaseBinaryName({ target });
  const binary = receipt.assets.find(({ name }) => name === cli);

  if (binary === undefined) {
    throw new Error('The candidate has no CLI for this qualification host');
  }

  return { guestImageId: image.Id, guestImageLog: `${JSON.stringify(image)}\n`, cli };
}

export async function runStaticAndFormatChecks({
  settings,
  module,
  temporary,
}: StaticChecksInput): Promise<ReadonlyArray<RetainedLog>> {
  const staticLog = await executeDistributionCommand({
    settings,
    command: 'mise',
    args: ['-C', CORE_FOLDER, 'run', 'check:static', ':::', 'infrastructure:verify', module],
  });

  const formats = await executeDistributionCommand({
    settings,
    command: settings.nodeExecutable,
    args: [
      join(CORE_FOLDER, 'packages/node/distribution/testing/shipped-formats.ts'),
      join(settings.folder, 'installation.json'),
    ],
  });

  return [
    { name: 'qualification-static.log', contents: sanitizeCandidateLog({ contents: staticLog, temporary }) },
    { name: 'qualification-shipped-formats.log', contents: sanitizeCandidateLog({ contents: formats, temporary }) },
  ];
}
