import { PROGRAM, readReadiness } from '@mechane/deploy-kernel';
import type { DeployFailed, OriginInput } from '@mechane/deploy-kernel';
import { stepLine, writeDiagnostic } from '@mechane/program';
import type { Readiness } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { DeployedRelease } from '../types.ts';
import { deployedVersion } from './deployed-version.ts';
import type { DeployedReleaseInput } from './types.ts';
import { versionTag } from './version-tag.ts';

/**
 * What production runs, as Cloudflare reports it: the tag of the version its latest deployment serves most, and that
 * release's readiness. A release that broke readiness has none, so a deploy or a rollback can still replace it.
 */
export const deployedRelease = Effect.fn('deployedRelease')(function* ({
  settings,
  name,
  origin,
}: DeployedReleaseInput): Effect.fn.Return<DeployedRelease, DeployFailed> {
  const versionId = yield* deployedVersion({ settings, name });
  const { tag } = yield* versionTag({ settings, name, versionId });

  return { tag, readiness: yield* optionalReadiness({ origin }) };
});

/** Production's readiness, or none once a diagnostic names why it did not answer. */
const optionalReadiness = Effect.fn('optionalReadiness')(
  function* ({ origin }: OriginInput): Effect.fn.Return<Option.Option<Readiness>, DeployFailed> {
    return Option.some(yield* readReadiness({ origin }));
  },
  Effect.catchTags({
    DeployFailed: (failure) =>
      Effect.sync(() => {
        writeDiagnostic({
          program: PROGRAM,
          line: `deployed state: no class's schema revision is compared, since this failed: ${stepLine(failure)}`,
        });

        return Option.none();
      }),
  }),
);
