import { Schema } from 'effect';

/** Extracts the configured subagent entries from a `coordinator` or `multiagent_20261001` configuration. */
export function multiagentMemberEntries<T>(
  memberSchema: Schema.Codec<T, unknown>,
  profile: unknown,
): ReadonlyArray<T> | null {
  const coordinator = Schema.Struct({ type: Schema.Literal('coordinator'), agents: Schema.Array(memberSchema) });

  if (Schema.is(coordinator)(profile)) {
    return profile.agents;
  }

  const modern = Schema.Struct({
    type: Schema.Literal('multiagent_20261001'),
    subagents: Schema.Union([
      Schema.Struct({ type: Schema.Literal('disabled') }),
      Schema.Struct({ type: Schema.Literal('enabled'), predefined_agents: Schema.Array(memberSchema) }),
    ]),
  });

  if (Schema.is(modern)(profile)) {
    if (profile.subagents.type === 'enabled') {
      return profile.subagents.predefined_agents;
    }

    return [];
  }

  return null;
}
