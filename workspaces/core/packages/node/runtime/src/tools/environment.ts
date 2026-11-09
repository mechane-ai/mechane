import { Record, Redacted } from 'effect';
import type { RuntimeStore } from '../store/database.ts';
import { ToolUnavailableError } from './errors.ts';
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

  return { variables, secrets };
}
