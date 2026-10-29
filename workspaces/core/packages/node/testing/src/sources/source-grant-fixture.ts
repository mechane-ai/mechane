import { Mech, SourceGrantState, SourceReport } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import { Effect } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import type { ScenarioFailure, SharedWorkspaceFixture, StackInput } from '../types.ts';

type SourceGrantFixtureInput = StackInput & { readonly workspace: SharedWorkspaceFixture };

type SourceGrantFixture = {
  readonly mechId: MechId;
  readonly absent: SourceGrantState;
  readonly first: SourceGrantState;
  readonly repeated: SourceGrantState;
};

const GRANT_CONFIGURATION = JSON.stringify({
  app_id: 1,
  installation_id: 1,
  repository_id: 1,
  owner: 'fixture',
  repository: 'private-source',
  base_branch: 'main',
  secret_reference: 'unconfigured-reader',
  write_paths: ['src'],
});

/** Grant configuration is local metadata; this fixture provides no provider credential or source checkout. */
export const sourceGrantFixture = Effect.fn('sourceGrantFixture')(function* ({
  stack,
  workspace,
}: SourceGrantFixtureInput): Effect.fn.Return<SourceGrantFixture, ScenarioFailure> {
  const command = { stack, environment: workspace.owner.environment };
  const selection = ['--workspace', workspace.workspaceId];

  const created = yield* runCli({
    ...command,
    args: [...selection, 'mech', 'create', '--name', 'grant-reader'],
    result: Mech,
  });

  const mechId = MechId.make(created.result.id);
  const args = [...selection, 'source', 'access', mechId];
  const read = { ...command, args, result: SourceGrantState };
  const absent = yield* runCli(read);
  const grantArgs = [...selection, 'source', 'grant', mechId, '--configuration', GRANT_CONFIGURATION];

  yield* runCli({ ...command, args: grantArgs, result: SourceReport });

  const first = yield* runCli(read);
  const repeated = yield* runCli(read);

  return { mechId, absent: absent.result, first: first.result, repeated: repeated.result };
});
