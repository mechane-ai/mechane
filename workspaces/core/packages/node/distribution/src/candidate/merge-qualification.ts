import { sha256Hex } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CORE_FOLDER, DistributionStep, QUALIFICATION_SHARDS } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { readDocument } from '../files/read-document.ts';
import type { ArtifactQualification } from '../qualification.ts';
import type { DistributionInput, FileDigest } from '../types.ts';
import {
  executeDistributionCommand,
  existingQualification,
  sealCandidateQualification,
  verifyAcceptanceCandidate,
  verifyCandidateUnchanged,
} from './candidate-context.ts';
import type { VerifiedCandidate } from './candidate-context.ts';
import {
  CatalogSummary,
  FORMATS_LOG_NAME,
  shardLogName,
  ShardReceipt,
  shardReceiptName,
  STATIC_LOG_NAME,
  STATIC_RECEIPT_NAME,
  StaticReceipt,
} from './shard-schema.ts';
import type { CandidateChecks, QualificationTools } from './shard-schema.ts';

const SUMMARY_PREFIX = 'SMOKE_CATALOG_SUMMARY ';

async function readExpectedCatalog({ settings }: DistributionInput): Promise<CatalogSummary> {
  const expectedRaw = await executeDistributionCommand({
    settings,
    command: settings.nodeExecutable,
    args: [join(CORE_FOLDER, 'packages/node/smoke/src/main.ts'), '--catalog-summary'],
  });

  const summaryLine = expectedRaw.split('\n').find((entry) => entry.startsWith(SUMMARY_PREFIX));

  if (summaryLine === undefined) {
    throw new Error('Could not read the expected smoke catalog summary');
  }

  return Schema.decodeUnknownSync(Schema.fromJsonString(CatalogSummary))(summaryLine.slice(SUMMARY_PREFIX.length));
}

type VerifyShardInput = {
  readonly receipt: ShardReceipt;
  readonly candidate: VerifiedCandidate;
  readonly installation: FileDigest;
  readonly baseline: ShardReceipt;
};

type VerifyStaticInput = {
  readonly receipt: StaticReceipt;
  readonly candidate: VerifiedCandidate;
  readonly installation: FileDigest;
};

type LoadedShard = { readonly receipt: ShardReceipt; readonly log: string };

function sameTools(left: QualificationTools, right: QualificationTools): boolean {
  const hasSameNode = left.node.sha256 === right.node.sha256 && left.node.version === right.node.version;
  const hasSameCelld = left.celld.sha256 === right.celld.sha256 && left.celld.version === right.celld.version;

  return hasSameNode && hasSameCelld;
}

type CandidateMetadata = Pick<StaticReceipt, 'public_commit' | 'artifacts' | 'installation' | 'worker_sha256'>;

function hasMatchingCandidateMetadata(
  receipt: CandidateMetadata,
  candidate: VerifiedCandidate,
  installation: FileDigest,
): boolean {
  const hasSameArtifacts =
    receipt.artifacts.sha256 === candidate.selected.sha256 && receipt.artifacts.bytes === candidate.selected.bytes;

  const hasSameInstallation =
    receipt.installation.sha256 === installation.sha256 && receipt.installation.bytes === installation.bytes;

  const hasSameDigests = hasSameArtifacts && hasSameInstallation;

  const hasSameSource =
    receipt.public_commit === candidate.source && receipt.worker_sha256 === candidate.manifest.worker.sha256;

  return hasSameDigests && hasSameSource;
}

function verifyStaticMatch({ receipt, candidate, installation }: VerifyStaticInput): string | null {
  if (hasMatchingCandidateMetadata(receipt, candidate, installation)) {
    return null;
  }

  return 'static qualification receipt qualified different candidate bytes';
}

function verifyShardMatch({ receipt, candidate, installation, baseline }: VerifyShardInput): string | null {
  const hasSameCandidate =
    hasMatchingCandidateMetadata(receipt, candidate, installation) &&
    receipt.guest_image === candidate.manifest.guest.digest;

  if (!hasSameCandidate) {
    return `shard ${receipt.shard} qualified different candidate bytes`;
  }

  if (receipt.cli !== baseline.cli || !sameTools(receipt.tools, baseline.tools)) {
    return `shard ${receipt.shard} used a different toolchain or CLI binary`;
  }

  return null;
}

type DuplicateGuaranteeInput = { readonly guarantees: ReadonlyArray<string> };

function firstDuplicateGuarantee({ guarantees }: DuplicateGuaranteeInput): string | null {
  const seen = new Set<string>();

  for (const guarantee of guarantees) {
    if (seen.has(guarantee)) {
      return guarantee;
    }

    seen.add(guarantee);
  }

  return null;
}

/** Combines verified parallel shard and static receipts into one canonical qualification.json. */
export const mergeQualification = Effect.fn('mergeQualification')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  if (settings.shardTarget === undefined || settings.shardTarget.length === 0) {
    return yield* new DistributionFailed({
      step: DistributionStep.Settings,
      reason: 'merge-qualification requires the folder containing completed shard receipts',
    });
  }

  const shardsFolder = resolve(settings.shardTarget);
  const candidate = yield* verifyAcceptanceCandidate({ settings });
  const existing = yield* existingQualification({ settings });

  if (existing !== null) {
    return existing;
  }

  const staticReceipt = yield* readDocument({ path: join(shardsFolder, STATIC_RECEIPT_NAME), schema: StaticReceipt });

  const staticLog = yield* Effect.tryPromise({
    try: () => readFile(join(shardsFolder, staticReceipt.static_log_file), 'utf8'),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  const formatsLog = yield* Effect.tryPromise({
    try: () => readFile(join(shardsFolder, staticReceipt.formats_log_file), 'utf8'),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  if (
    sha256Hex({ contents: staticLog }) !== staticReceipt.static_log_sha256 ||
    sha256Hex({ contents: formatsLog }) !== staticReceipt.formats_log_sha256
  ) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'static qualification log does not match its receipt digest',
    });
  }

  const loaded: Array<LoadedShard> = [];

  for (const shard of QUALIFICATION_SHARDS) {
    const receiptPath = join(shardsFolder, shardReceiptName({ shard }));
    const receipt = yield* readDocument({ path: receiptPath, schema: ShardReceipt });

    if (receipt.shard !== shard || receipt.log_file !== shardLogName({ shard })) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: `shard receipt ${shard} carries mismatched shard metadata`,
      });
    }

    const log = yield* Effect.tryPromise({
      try: () => readFile(join(shardsFolder, receipt.log_file), 'utf8'),
      catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
    });

    if (sha256Hex({ contents: log }) !== receipt.log_sha256) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: `shard log ${receipt.log_file} does not match its receipt digest`,
      });
    }

    loaded.push({ receipt, log });
  }

  const firstShard = loaded[0];

  if (firstShard === undefined) {
    return yield* new DistributionFailed({ step: DistributionStep.Verify, reason: 'no qualification shards found' });
  }

  const guestShard = loaded.find(({ receipt }) => receipt.guest_image_log.length > 0);

  if (guestShard === undefined) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'no container-bearing qualification shard recorded a guest image inspection log',
    });
  }

  const expected = yield* Effect.tryPromise({
    try: () => readExpectedCatalog({ settings }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Command, reason: String(cause) }),
  });

  const unchanged = yield* verifyCandidateUnchanged({ settings, candidate });

  const staticMismatch = verifyStaticMatch({ receipt: staticReceipt, candidate, installation: unchanged.installation });

  if (staticMismatch !== null) {
    return yield* new DistributionFailed({ step: DistributionStep.Verify, reason: staticMismatch });
  }

  for (const { receipt } of loaded) {
    const mismatch = verifyShardMatch({
      receipt,
      candidate,
      installation: unchanged.installation,
      baseline: firstShard.receipt,
    });

    if (mismatch !== null) {
      return yield* new DistributionFailed({ step: DistributionStep.Verify, reason: mismatch });
    }
  }

  const guarantees = loaded.flatMap(({ receipt }) => receipt.catalog.guarantees);
  const duplicate = firstDuplicateGuarantee({ guarantees });

  if (duplicate !== null) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: `duplicate guarantee across qualification shards: ${duplicate}`,
    });
  }

  const seen = new Set(guarantees);
  const missing = expected.guarantees.filter((guarantee) => !seen.has(guarantee));

  if (missing.length > 0 || guarantees.length !== expected.count) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: `qualification shards do not match the full smoke catalog (${guarantees.length}/${expected.count})`,
    });
  }

  const combinedLog = loaded.map(({ receipt, log }) => `=== shard ${receipt.shard} ===\n${log}`).join('\n');

  const checked: CandidateChecks = {
    logs: [
      { name: STATIC_LOG_NAME, contents: staticLog },
      { name: FORMATS_LOG_NAME, contents: formatsLog },
      { name: 'qualification-guest-image.log', contents: guestShard.receipt.guest_image_log },
      { name: 'qualification-artifact-scenarios.log', contents: combinedLog },
    ],
    catalog: { count: expected.count, guarantees: expected.guarantees },
    guestImage: candidate.manifest.guest.digest,
    cli: firstShard.receipt.cli,
    tools: firstShard.receipt.tools,
  };

  return yield* sealCandidateQualification({ settings, candidate, unchanged, checked });
});
