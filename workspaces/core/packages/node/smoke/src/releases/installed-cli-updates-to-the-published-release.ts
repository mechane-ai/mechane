import { exitStatusText, SUCCESS_STATUS, UpdateOutcome } from '@mechane/program';
import { check } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect, Option } from 'effect';
import { hostReleases } from './host-releases.ts';
import { installedCli } from './installed-cli.ts';
import type { HostRelease, HostReleases, UpdateRuns } from './types.ts';
import { updateRuns } from './update-runs.ts';

/** The code with which `mechane update` refuses a binary that differs from its manifest's. */
const MISMATCH_CODE = 'BinaryMismatched';

type UpdateDetailInput = { readonly releases: HostReleases; readonly runs: UpdateRuns };

/**
 * Installs a release with the install script the stack serves, then publishes a later release with a corrupted binary,
 * which install.sh and `mechane update` must refuse. It then publishes the later release itself, which the update must
 * install over its own binary.
 */
export const installedCliUpdatesToThePublishedRelease = Effect.fn('installedCliUpdatesToThePublishedRelease')(
  function* ({ stack, guarantee }: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
    const releases = yield* hostReleases({ stack });
    const { folder, installed, published } = releases;
    const binary = yield* installedCli({ stack, folder, release: installed });
    const runs = yield* updateRuns({ stack, folder, binary, published });
    const { installRefusal, refused, kept, checked, updated, replaced, repeated } = runs;
    const releaseLine: (release: HostRelease) => string = ({ manifest }) => `mechane ${manifest.release}`;
    const [installedLine, publishedLine] = [installed, published].map(releaseLine);

    yield* check({
      name: guarantee,
      conditions: [
        !Option.contains(installRefusal.status, SUCCESS_STATUS),
        installRefusal.left.length === 0,
        refused.code === MISMATCH_CODE,
        kept.releaseLine === installedLine,
        kept.sha256 === installed.binary.sha256,
        checked.outcome === UpdateOutcome.Available,
        updated.outcome === UpdateOutcome.Updated,
        replaced.releaseLine === publishedLine,
        replaced.sha256 === published.binary.sha256,
        repeated.outcome === UpdateOutcome.UpToDate,
      ],
      detail: updateDetail({ releases, runs }),
    });
  },
);

/** What the scenario saw at each step, for a failed check's detail. */
function updateDetail({ releases, runs }: UpdateDetailInput): string {
  const { installRefusal, refused, kept, checked, updated, replaced, repeated } = runs;

  return [
    `install.sh exited ${exitStatusText({ status: installRefusal.status })} on the corrupted release and left [${installRefusal.left.join(', ')}]`,
    `the update got ${refused.code}, and the binary reported "${kept.releaseLine}"`,
    `--check found ${checked.outcome}, and the update ${updated.outcome} from ${updated.from} to ${updated.to}`,
    `then the binary reported "${replaced.releaseLine}" with SHA-256 ${replaced.sha256}`,
    `where release ${releases.published.manifest.release} names ${releases.published.binary.sha256}`,
    `and the next update found ${repeated.outcome}`,
  ].join('; ');
}
