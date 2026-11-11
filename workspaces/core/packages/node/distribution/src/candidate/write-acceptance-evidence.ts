import { sha256Hex } from '@mechane/program';
import { readFile, writeFile } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { QUALIFICATION_FORMAT_VERSION, SOURCE_FOLDER } from '../constants.ts';
import { qualificationInputDigest } from '../qualification.ts';
import type { QualificationEvidence, QualificationRequest, QualifiedFile } from '../qualification.ts';
import type { FileDigest } from '../types.ts';
import type { CandidateChecks } from './run-candidate-checks.ts';

type WriteEvidenceInput = {
  readonly folder: string;
  readonly source: string;
  readonly tree: string;
  readonly artifacts: FileDigest;
  readonly installation: FileDigest;
  readonly workerSha256: string;
  readonly checked: CandidateChecks;
};

/** Creates reports only from completed canonical checks, never from operator-written success declarations. */
export async function writeAcceptanceEvidence({
  folder,
  source,
  tree,
  artifacts,
  installation,
  workerSha256,
  checked,
}: WriteEvidenceInput): Promise<QualificationRequest> {
  const inputs: Record<keyof QualificationRequest['inputs'], Array<QualifiedFile>> = {
    toolchain: [],
    fixtures: [],
    policy: [],
    configuration: [],
  };

  async function put(path: string, value: unknown): Promise<QualifiedFile> {
    const text = `${JSON.stringify(value)}\n`;

    await writeFile(join(folder, path), text, { flag: 'wx' });

    return { path, sha256: sha256Hex({ contents: text }), bytes: Buffer.byteLength(text) };
  }

  const lock = await readFile(join(SOURCE_FOLDER, 'mise.lock'));
  const packages = await readFile(join(SOURCE_FOLDER, 'workspaces/core/pnpm-lock.yaml'));

  inputs.toolchain.push(
    await put('qualification-toolchain.json', {
      node_version: process.versions.node,
      platform: platform(),
      architecture: arch(),
      mise_lock_sha256: sha256Hex({ contents: lock }),
      package_lock_sha256: sha256Hex({ contents: packages }),
      tools: checked.tools,
    }),
  );
  inputs.fixtures.push(
    await put('qualification-fixtures.json', { fixture_only: true, public_commit: source, catalog: checked.catalog }),
  );
  inputs.policy.push(await put('qualification-source.json', { public_commit: source, source_tree: tree.trim() }));
  inputs.configuration.push(
    await put('qualification-configuration.json', {
      artifact_mode: true,
      source_watch: false,
      worker_sha256: workerSha256,
      guest_manifest: checked.guestImage,
      cli: checked.cli,
    }),
  );

  for (const log of checked.logs) {
    await writeFile(join(folder, log.name), log.contents, { flag: 'wx' });
    inputs.policy.push({
      path: log.name,
      sha256: sha256Hex({ contents: log.contents }),
      bytes: Buffer.byteLength(log.contents),
    });
  }

  const binding = {
    format_version: QUALIFICATION_FORMAT_VERSION,
    outcome: 'passed',
    public_commit: source,
    artifacts: { path: 'artifacts.json', ...artifacts },
    installation: { path: 'installation.json', ...installation },
    inputs_sha256: qualificationInputDigest({ inputs }),
  } as const;

  const reports: ReadonlyArray<QualificationEvidence> = [
    {
      ...binding,
      name: 'complete',
      details: { command: ['mise', 'run', 'check:static'], infrastructure: 'infrastructure:verify' },
    },
    {
      ...binding,
      name: 'artifact-scenarios',
      details: {
        catalog: checked.catalog,
        worker_sha256: workerSha256,
        guest_manifest: checked.guestImage,
        cli: checked.cli,
      },
    },
    {
      ...binding,
      name: 'shipped-formats',
      details: { scope: 'current installation inventory and migration integrity' },
    },
  ];

  const checks: Array<QualificationRequest['checks'][number]> = [];

  for (const report of reports) {
    checks.push({
      name: report.name,
      outcome: 'passed',
      evidence: await put(`qualification-${report.name}.json`, report),
    });
  }

  return { inputs, checks };
}
