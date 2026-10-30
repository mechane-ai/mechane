import type { LocalSandboxProvider } from '@mechane/deployment';
import { callbackUrl } from '@mechane/protocol';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { randomBytes } from 'node:crypto';
import { LOCAL_GITHUB, SECRET_BYTES } from '../constants.ts';
import type { StackFailed } from '../errors.ts';
import { startFakeGitHub } from '../github/start-fake-github.ts';
import { generateCredentialKeyring } from '../state/secrets/generate-credential-keyring.ts';
import type { Stack, StackSettings, StackVariables } from '../types.ts';
import { localModelUpstream } from './local-model-upstream.ts';
import { localSandboxes } from './local-sandboxes.ts';
import type { LocalService } from './types.ts';

/** The services a stack serves beside celld, as the stack exposes them. */
type ServedServices = Pick<Stack, 'githubOrigin' | 'modelUpstream' | 'launcherKey' | 'credentialKeyring'>;

/** The services a stack serves beside celld, and the variables that point the Worker at them. */
type LocalServices = { readonly served: ServedServices; readonly variables: StackVariables };

type LocalServicesInput = {
  readonly origin: URL;
  readonly settings: StackSettings;
  readonly sandboxProvider: LocalSandboxProvider;
  readonly sandboxesFolder: string;
  /** The program's own variables, which name a person's model upstream when they set one. */
  readonly variables: StackVariables;
};

type LocalGitHubInput = { readonly origin: URL };

/**
 * Starts the services a stack serves beside celld: the local GitHub, the scripted model upstream and, for host
 * sandboxes, the host launcher. It answers with them and the variables that point the Worker at them, which give every
 * workspace a sandbox.
 */
export const localServices = Effect.fn('localServices')(function* ({
  origin,
  settings,
  sandboxProvider,
  sandboxesFolder,
  variables,
}: LocalServicesInput): Effect.fn.Return<LocalServices, StackFailed, Scope.Scope> {
  const github = yield* localGitHub({ origin });
  const modelUpstream = yield* localModelUpstream();
  const sandboxes = yield* localSandboxes({ sandboxProvider, settings, sandboxesFolder, variables });
  const { keyring: credentialKeyring, encoded } = generateCredentialKeyring();

  return {
    served: {
      githubOrigin: github.service,
      modelUpstream: modelUpstream.service,
      launcherKey: sandboxes.service,
      credentialKeyring,
    },
    variables: { credentialKeyring: encoded, ...github.variables, ...modelUpstream.variables, ...sandboxes.variables },
  };
});

/** Starts the local GitHub with a fresh client secret, and answers with its origin and the variables naming it. */
const localGitHub = Effect.fn('localGitHub')(function* ({
  origin,
}: LocalGitHubInput): Effect.fn.Return<LocalService<URL>, StackFailed, Scope.Scope> {
  const { clientId, login } = LOCAL_GITHUB;
  const clientSecret = randomBytes(SECRET_BYTES).toString('hex');
  const redirectUri = callbackUrl({ origin });
  const githubOrigin = yield* startFakeGitHub({ github: { clientId, clientSecret, callbackUrl: redirectUri, login } });

  return {
    service: githubOrigin,
    variables: {
      githubWebOrigin: githubOrigin.origin,
      githubApiOrigin: githubOrigin.origin,
      githubClientId: clientId,
      githubClientSecret: clientSecret,
    },
  };
});
