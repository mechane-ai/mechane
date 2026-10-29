import type { ProgramSettings } from '@mechane/deploy-kernel';
import { WORKER_VARIABLES } from '@mechane/deployment';
import { RELEASE } from '@mechane/protocol';
import type { BaseConfiguration } from '@mechane/wrangler';
import { Option } from 'effect';

type RenderVariablesInput = {
  readonly base: BaseConfiguration;
  readonly settings: ProgramSettings;
  readonly revision: string;
};

/** Each release retains an installation's image namespace while choosing a fresh Tensorlake image. */
export function renderVariables({ base, settings, revision }: RenderVariablesInput): Readonly<Record<string, string>> {
  const overlay = settings.installation;

  const variables: Record<string, string> = {
    ...base.vars,
    ...overlay.vars,
    [WORKER_VARIABLES.workerRevision]: revision,
  };

  const imagePrefix = Option.fromNullishOr(overlay.tensorlake_image_prefix);

  if (Option.isSome(imagePrefix)) {
    variables[WORKER_VARIABLES.tensorlakeImage] = `${imagePrefix.value}-v${RELEASE}`;
  }

  return variables;
}
