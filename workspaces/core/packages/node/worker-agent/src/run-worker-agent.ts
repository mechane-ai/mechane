import Anthropic from '@anthropic-ai/sdk';
import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { Schema } from 'effect';

const DecodedWorkSecret = Schema.Struct({
  sessions_token: Schema.NonEmptyString,
  api_base_url: Schema.optionalKey(Schema.NonEmptyString),
});

export type AssignedWorkerLease = {
  readonly apiOrigin: string;
  readonly environmentId: string;
  readonly sessionId: string;
  readonly workId: string;
  readonly workSecret: string;
  readonly workdir: string;
  readonly signal?: AbortSignal | undefined;
};

/** Decodes the Anthropic Managed Agents work secret payload to extract the scoped session token. */
export function decodeWorkSecretToken(workSecret: string): string {
  const jsonText = Buffer.from(workSecret, 'base64url').toString('utf8');
  const parsed = Schema.decodeUnknownSync(DecodedWorkSecret)(JSON.parse(jsonText));

  return parsed.sessions_token;
}

/** Runs one assigned Managed Agents work item inside any pluggable sandbox using the official Anthropic SDK worker. */
export async function runAssignedSandboxWork({
  apiOrigin,
  environmentId,
  sessionId,
  workId,
  workSecret,
  workdir,
  signal,
}: AssignedWorkerLease): Promise<void> {
  const token = decodeWorkSecretToken(workSecret);
  const client = new Anthropic({ authToken: token, baseURL: apiOrigin, logLevel: 'off' });
  const tools = betaAgentToolset20260401({ workdir });
  const worker = client.beta.environments.work.worker({ workdir, tools });

  await worker.handleItem({ workId, sessionId, environmentId, workSecret, ...(signal !== undefined && { signal }) });
}
