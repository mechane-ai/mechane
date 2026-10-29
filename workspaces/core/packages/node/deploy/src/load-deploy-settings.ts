import { CREDENTIAL_VARIABLES, DeployMode, readInstallation } from '@mechane/deploy-kernel';
import type { DeployFailed, DeploySettings } from '@mechane/deploy-kernel';
import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { Effect, Option, Record } from 'effect';
import { tmpdir } from 'node:os';
import { isatty } from 'node:tty';
import { decodeInvocation } from './decode-invocation.ts';
import { readCredentials } from './read-credentials.ts';
import { resolveInstallationPath } from './resolve-installation-path.ts';

const ENVIRONMENT_FILE_VARIABLE = 'MECHANE_DEPLOY_ENV_FILE';
const CONFIGURATION_FILE_VARIABLE = 'MECHANE_DEPLOY_CONFIG_FILE';
const STDIN_DESCRIPTOR = 0;
const INHERITED_VARIABLES = ['PATH', 'HOME', 'DOCKER_HOST'] as const;
const GIT_VARIABLES = ['SSH_AUTH_SOCK'] as const;
const UPLOAD_VARIABLES = [CREDENTIAL_VARIABLES.cloudflareApiToken, CREDENTIAL_VARIABLES.cloudflareAccountId] as const;
const WRANGLER_LOG_VARIABLE = 'WRANGLER_LOG_PATH';

type PresentValuesInput = {
  readonly names: ReadonlyArray<string>;
  /** Undefined entries are omitted from the child environment. */
  readonly source: Readonly<Record<string, string | undefined>>;
};

/** Every cloud operation names its installation; only rendering defaults to the public example. */
export const loadDeploySettings = Effect.fn('loadDeploySettings')(function* (): Effect.fn.Return<
  DeploySettings,
  DeployFailed
> {
  const args = process.argv.slice(PROGRAM_ARGUMENTS_START);
  const invocation = yield* decodeInvocation({ args });
  const configured = Option.fromNullishOr(process.env[CONFIGURATION_FILE_VARIABLE]);
  const requested = Option.orElse(invocation.configuration, () => configured);

  const configurationPath = yield* resolveInstallationPath({ requested, mode: invocation.mode });
  const installation = yield* readInstallation({ path: configurationPath });

  const program = {
    configurationPath,
    installation,
    inherited: presentValues({ names: INHERITED_VARIABLES, source: process.env }),
    gitAgent: presentValues({ names: GIT_VARIABLES, source: process.env }),
    wranglerLog: presentValues({ names: [WRANGLER_LOG_VARIABLE], source: process.env }),
  };

  if (invocation.mode === DeployMode.Render) {
    return { ...invocation, ...program };
  }

  if (invocation.mode === DeployMode.Upload) {
    return { ...invocation, ...program, cloudflare: presentValues({ names: UPLOAD_VARIABLES, source: process.env }) };
  }

  const namedReferences: Readonly<Record<string, string>> = installation.secret_refs;
  const names = [...UPLOAD_VARIABLES, ...Record.values(namedReferences)];
  const inheritedCredentials = presentValues({ names, source: process.env });
  const path = Option.fromNullishOr(process.env[ENVIRONMENT_FILE_VARIABLE]);
  const credentials = yield* readCredentials({ path, inheritedCredentials, references: installation.secret_refs });

  return { ...invocation, ...program, credentials, temporaryRoot: tmpdir(), isInteractive: isatty(STDIN_DESCRIPTOR) };
});

function presentValues({ names, source }: PresentValuesInput): Readonly<Record<string, string>> {
  const presentEntry: (name: string) => ReadonlyArray<readonly [string, string]> = (name) => {
    const selected = Option.fromNullishOr(source[name]);
    const values = Option.toArray(selected);

    return values.map((value) => [name, value] as const);
  };

  const entries = names.flatMap(presentEntry);

  return Record.fromEntries(entries);
}
