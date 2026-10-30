import { LOCAL_PACKAGE_FILES } from '@mechane/stack';
import type { LocalPackage } from '@mechane/stack';
import { Effect, Record } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { archiveEntryDigest } from '../files/archive-entry-digest.ts';
import { runCommand } from '../files/run-command.ts';
import type { DistributionSettings } from '../types.ts';
import { LOCAL_NOTICES } from './constants.ts';

type VerifyLocalInputsInput = {
  readonly path: string;
  readonly local: LocalPackage;
  readonly settings: DistributionSettings;
};

/** Rejects missing or unsafe entries and verifies the exact bytes declared by the manifest. */
export const verifyLocalInputs = Effect.fn('verifyLocalInputs')(function* ({
  path,
  local,
  settings,
}: VerifyLocalInputsInput): Effect.fn.Return<void, DistributionFailed> {
  yield* verifyLocalInventory({ path, settings });

  for (const [entry, expected] of Record.toEntries(local.files)) {
    const digest = yield* archiveEntryDigest({ path, entry, settings });

    if (digest.sha256 !== expected.sha256 || digest.bytes !== expected.bytes) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: 'local archive entry differs from its manifest',
      });
    }
  }
});

type VerifyLocalInventoryInput = Pick<VerifyLocalInputsInput, 'path' | 'settings'>;

const verifyLocalInventory = Effect.fn('verifyLocalInventory')(function* ({
  path,
  settings,
}: VerifyLocalInventoryInput): Effect.fn.Return<void, DistributionFailed> {
  const listing = yield* runCommand({ command: 'tar', args: ['-tf', path], settings });
  const entries = listing.trim().split('\n');
  const expected = [...Record.values(LOCAL_PACKAGE_FILES), ...LOCAL_NOTICES];

  const rootName: (entry: string) => string = (entry) => entry.split('/', 1).join('');
  const names = entries.map(rootName);
  const roots = new Set(names);
  const isComplete = expected.every((name) => roots.has(name));

  const isSafeEntry: (entry: string) => boolean = (entry) => !entry.startsWith('/') && !entry.split('/').includes('..');
  const isSafe = entries.every(isSafeEntry);

  if (!isComplete || !isSafe || roots.size !== expected.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'local archive inventory differs from the required files',
    });
  }
});
