import { Record, Redacted } from 'effect';
import { loadRuntimeConfiguration } from '../config.ts';
import type { RuntimeStore } from '../store/database.ts';
import { ToolUnavailableError } from './errors.ts';
import { mintGitHubToken } from './github-token.ts';
import type { PreparedEnvironment, RuntimeToolContext } from './types.ts';

type EnvironmentInput = RuntimeToolContext & { readonly store: RuntimeStore };

export async function prepareEnvironment({
  store,
  workspaceId,
  mechId,
}: EnvironmentInput): Promise<PreparedEnvironment> {
  const access = await store.getExecutionAccess({ workspaceId, mechId });
  const variables: Record<string, string> = {};
  const secrets: Record<string, string> = {};

  if (access === null) {
    return { environment: { variables, secrets }, githubToken: null };
  }

  Object.assign(variables, access.variables);

  for (const [name, reference] of Record.toEntries(access.secrets)) {
    const credential = await store.getCredential({ workspaceId, reference });

    if (credential === null) {
      throw new ToolUnavailableError(`The execution credential ${name} is unavailable`);
    }

    secrets[name] = Redacted.value(credential);
  }

  if (access.github === null) {
    return { environment: { variables, secrets }, githubToken: null };
  }

  const credential = await store.getCredential({ workspaceId, reference: access.github.secretReference });

  if (credential === null) {
    throw new ToolUnavailableError('The GitHub App credential is unavailable');
  }

  const configuration = loadRuntimeConfiguration();

  const githubToken = await mintGitHubToken({
    origin: configuration.githubApiOrigin,
    grant: access.github,
    privateKey: Redacted.value(credential),
  });

  secrets['GH_TOKEN'] = githubToken;
  variables['GH_REPO'] = `${access.github.owner}/${access.github.repository}`;
  variables['GH_PROMPT_DISABLED'] = '1';

  return { environment: { variables, secrets }, githubToken };
}
