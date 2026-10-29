import { API_ORIGINS, DeployFailed, DeployStep, gitSucceeds, PROGRAM, readJson, runGit } from '@mechane/deploy-kernel';
import { StepSubject, writeDiagnostic } from '@mechane/program';
import { Effect, Option, Redacted } from 'effect';
import { ScriptList } from './schemas.ts';
import type { DeployedRelease, DeployedStateInput, WorkerUploadedInput } from './types.ts';
import { deployedRelease } from './versions/deployed-release.ts';

/**
 * What production runs: nothing when the account holds no script of the Worker's name, so this is a first deploy.
 * Otherwise the release its latest deployment serves most, whose tag `HEAD` must contain, with its readiness. Any other
 * script of that name stops the deploy, since Wrangler would skip every migration whose tag its configuration applied.
 */
export const deployedState = Effect.fn('deployedState')(function* ({
  settings,
  rendered,
  origin,
}: DeployedStateInput): Effect.fn.Return<Option.Option<DeployedRelease>, DeployFailed> {
  if (!(yield* isWorkerUploaded({ credentials: settings.credentials, name: rendered.name }))) {
    writeDiagnostic({ program: PROGRAM, line: `deployed state: no script is named ${rendered.name}; a first deploy` });

    return Option.none();
  }

  const deployed = yield* deployedRelease({ settings, name: rendered.name, origin });
  const tags = yield* runGit({ args: ['tag', '--list', deployed.tag], settings });
  const isAncestor = yield* gitSucceeds({ args: ['merge-base', '--is-ancestor', deployed.tag, 'HEAD'], settings });

  if (tags.trim() !== deployed.tag || !isAncestor) {
    return yield* new DeployFailed({
      step: DeployStep.CheckDeployedTag,
      subjects: [StepSubject.cases.Tag.make({ tag: deployed.tag })],
      reason: `it runs ${deployed.tag}, which is no tag that HEAD contains`,
    });
  }

  writeDiagnostic({ program: PROGRAM, line: `deployed state: production runs ${deployed.tag}, which HEAD contains` });

  return Option.some(deployed);
});

/** Whether the account holds a Worker script of the Worker's name, as Cloudflare's API lists the account's scripts. */
function isWorkerUploaded({ credentials, name }: WorkerUploadedInput): Effect.Effect<boolean, DeployFailed> {
  const account = Redacted.value(credentials.cloudflareAccountId);

  return readJson({
    url: new URL(`${API_ORIGINS.cloudflare}/accounts/${account}/workers/scripts`),
    init: {},
    token: credentials.cloudflareApiToken,
    schema: ScriptList,
    step: DeployStep.ListScripts,
  }).pipe(Effect.map(({ result }) => result.some((worker) => worker.id === name)));
}
