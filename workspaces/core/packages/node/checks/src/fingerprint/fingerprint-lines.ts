import type { InheritedInput, InputUnreadable } from '@mechane/checks-kernel';
import { trackedFiles, workspaceMembers } from '@mechane/checks-kernel';
import { sha256Hex } from '@mechane/program';
import { Effect } from 'effect';
import { bundleEntries } from './bundle-entries.ts';
import { bundleHash } from './bundle-hash.ts';
import { TOTAL_ROLE } from './constants.ts';
import { inputsHash } from './inputs-hash.ts';
import type { RoleHash } from './types.ts';

/** The role of the inputs besides the bundles, whose hash covers their contents only, so a move keeps it. */
const INPUTS_ROLE = 'inputs';

/** How many bundles build at once, which leaves CPUs to the other builders of a shared host. */
const BUILD_CONCURRENCY = 2;

/**
 * The fingerprint as `<role> <hash>` lines sorted by role. A line hashes each program's minified bundle, and one the
 * inputs besides TypeScript. The last line hashes the lines before it.
 */
export const fingerprintLines = Effect.fn('fingerprintLines')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const files = yield* trackedFiles({ inherited });
  const members = yield* workspaceMembers();
  const bundles = yield* bundleEntries({ files, members });

  const hashes = yield* Effect.forEach(bundles, (bundle) => bundleHash({ bundle, inherited }), {
    concurrency: BUILD_CONCURRENCY,
  });

  const inputs = yield* inputsHash({ files });

  /** A role's line of the fingerprint. */
  const roleLine: (roleHash: RoleHash) => string = ({ role, hash }) => `${role} ${hash}`;
  const lines = [...hashes, { role: INPUTS_ROLE, hash: inputs }].map(roleLine).toSorted();

  return [...lines, `${TOTAL_ROLE} ${sha256Hex({ contents: lines.join('\n') })}`];
});
