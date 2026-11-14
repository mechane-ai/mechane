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
  sessionId,
  runId,
}: EnvironmentInput): Promise<PreparedEnvironment> {
  const access = await store.getExecutionAccess({ workspaceId, mechId });
  const configuration = toolConfiguration();

  const reserved = {
    MECHANE_ORIGIN: configuration.toolOrigin,
    MECHANE_WORKSPACE_ID: workspaceId,
    MECHANE_MECH_ID: mechId,
    MECHANE_SESSION_ID: sessionId,
    MECHANE_RUN_ID: runId,
  };

  const variables: Record<string, string> = { ...access?.variables, ...reserved };
  const secrets: Record<string, string> = {};

  const self = await createSelfEnvironment({
    workspaceId,
    mechId,
    publicOrigin: configuration.toolOrigin,
    serviceKey: Redacted.value(configuration.sandbox.bearer),
  });

  if (access !== null) {
    for (const [name, reference] of Record.toEntries(access.secrets)) {
      if (!Object.hasOwn(reserved, name)) {
        const credential = await store.getCredential({ workspaceId, reference });

        if (credential === null) {
          throw new ToolUnavailableError(`The execution credential ${name} is unavailable`);
        }

        secrets[name] = Redacted.value(credential);
      }
    }
  }

  const token = self[SELF_TOKEN_VARIABLE];

  if (token === undefined) {
    throw new Error('The mech credential could not be minted');
  }

  secrets[SELF_TOKEN_VARIABLE] = token;

  return { variables: Record.remove(variables, SELF_TOKEN_VARIABLE), secrets };
}
