import { SELF_TOKEN_VARIABLE } from '@mechane/protocol';
import { Record, Redacted } from 'effect';
import { createSelfEnvironment } from '../self/credential.ts';
import { toolConfiguration } from './context.ts';
import type { RuntimeToolStore } from './context.ts';
import { ToolUnavailableError } from './errors.ts';
import type { PreparedEnvironment, RuntimeToolContext } from './types.ts';

type EnvironmentInput = RuntimeToolContext & { readonly store: RuntimeToolStore };

export async function prepareEnvironment({
  store,
  workspaceId,
  mechId,
}: EnvironmentInput): Promise<PreparedEnvironment> {
  const access = await store.getExecutionAccess({ workspaceId, mechId });
  const variables: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  const configuration = toolConfiguration();

  const self = await createSelfEnvironment({
    workspaceId,
    mechId,
    publicOrigin: configuration.toolOrigin,
    serviceKey: Redacted.value(configuration.sandbox.bearer),
  });

  if (access === null) {
    variables['MECHANE_ORIGIN'] = configuration.toolOrigin;
    const token = self[SELF_TOKEN_VARIABLE];

    if (token === undefined) {
      throw new Error('The mech credential could not be minted');
    }

    secrets[SELF_TOKEN_VARIABLE] = token;

    return { variables, secrets };
  }

  Object.assign(variables, access.variables);

  for (const [name, reference] of Record.toEntries(access.secrets)) {
    const credential = await store.getCredential({ workspaceId, reference });

    if (credential === null) {
      throw new ToolUnavailableError(`The execution credential ${name} is unavailable`);
    }

    secrets[name] = Redacted.value(credential);
  }

  variables['MECHANE_ORIGIN'] = configuration.toolOrigin;
  delete secrets['MECHANE_ORIGIN'];
  const token = self[SELF_TOKEN_VARIABLE];

  if (token === undefined) {
    throw new Error('The mech credential could not be minted');
  }

  secrets[SELF_TOKEN_VARIABLE] = token;

  return { variables: Record.remove(variables, SELF_TOKEN_VARIABLE), secrets };
}
