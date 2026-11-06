import { ExecutionAccessUnavailable } from '@mechane/harness-tools';
import {
  createGitHubToken,
  GITHUB_TOKEN_PERMISSION,
  resolveIntegrationSecret,
  revokeGitHubToken,
} from '@mechane/integrations';
import type { MechId, WorkspaceId } from '@mechane/records';
import { ExecutionAccessReading, workspaceStub } from '@mechane/rpc';
import type { ObjectSettings } from '@mechane/rpc';
import { Option, Record, Result, Schema } from 'effect';
import type { Redacted } from 'effect';
import type { PreparedExecutionEnvironment } from './types.ts';

type PrepareExecutionEnvironmentInput = {
  readonly settings: ObjectSettings;
  readonly workspaceId: WorkspaceId;
  readonly mechId: MechId;
};

/** Resolves the current owner's grant once per command; credentials exist only in this invocation and its guest. */
export async function prepareExecutionEnvironment({
  settings,
  workspaceId,
  mechId,
}: PrepareExecutionEnvironmentInput): Promise<Result.Result<PreparedExecutionEnvironment, ExecutionAccessUnavailable>> {
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const response = await workspace.executionAccess({ mechId });
  const decoded = Schema.decodeUnknownResult(ExecutionAccessReading)(response);

  if (Result.isFailure(decoded)) {
    const failure = ExecutionAccessUnavailable.make({ reason: 'Execution access could not be read' });

    return Result.fail(failure);
  }

  const answer = decoded.success;
  const empty: PreparedExecutionEnvironment = { environment: { variables: {}, secrets: {} }, release: Option.none() };

  if (ExecutionAccessReading.guards.MechNotFound(answer) || Option.isNone(answer.configuration.access)) {
    return Result.succeed(empty);
  }

  const access = answer.configuration.access.value;
  const secrets: Record<string, Redacted.Redacted> = {};

  for (const [name, secretReference] of Record.toEntries(access.secrets)) {
    const resolved = await resolveIntegrationSecret({ settings, workspaceId, secretReference });

    if (Result.isFailure(resolved) || Option.isNone(resolved.success)) {
      const failure = ExecutionAccessUnavailable.make({ reason: `Execution credential ${name} is unavailable` });

      return Result.fail(failure);
    }

    secrets[name] = resolved.success.value;
  }

  if (Option.isNone(access.github)) {
    return Result.succeed({ ...empty, environment: { variables: access.variables, secrets } });
  }

  const grant = access.github.value;

  const token = await createGitHubToken({
    origin: settings.githubApiOrigin,
    settings,
    workspaceId,
    grant,
    permission: GITHUB_TOKEN_PERMISSION.Agent,
  });

  if (Result.isFailure(token)) {
    const failure = ExecutionAccessUnavailable.make({ reason: token.failure.reason });

    return Result.fail(failure);
  }

  const credential = token.success.token;

  secrets['GH_TOKEN'] = credential;

  async function release(): Promise<void> {
    await revokeGitHubToken({ origin: settings.githubApiOrigin, token: credential });
  }

  const repository = [grant.owner, grant.repository].join('/');

  const revoke = Option.some(release);

  return Result.succeed({
    environment: { variables: { ...access.variables, GH_REPO: repository, GH_PROMPT_DISABLED: '1' }, secrets },
    release: revoke,
  });
}
