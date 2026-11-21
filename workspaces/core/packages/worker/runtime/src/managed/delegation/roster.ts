import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { multiagentMemberEntries } from '../multiagent.ts';
import { ManagedWireObject } from '../protocol.ts';
import type { ManagedSessionOpen } from '../protocol.ts';

const Agent = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.NonEmptyString,
    name: Schema.NonEmptyString,
    model: Schema.StructWithRest(Schema.Struct({ id: Schema.NonEmptyString }), [ManagedWireObject]),
    version: Schema.Int.check(Schema.isGreaterThan(0)),
    system: Schema.NullOr(Schema.String),
    tools: Schema.Array(ManagedWireObject),
    mcp_servers: Schema.Array(ManagedWireObject),
  }),
  [ManagedWireObject],
);

const Installed = Schema.Struct({
  agents: Schema.Array(Agent),
  ownerName: Schema.NonEmptyString,
  memoryInstructions: Schema.optional(Schema.String),
  childSkillInstructions: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  creatorId: Schema.NonEmptyString,
  runtimeIds: Schema.Record(Schema.String, Schema.NonEmptyString),
});

export type CoordinatorRoster = typeof Installed.Type;

export function encodeCoordinatorRoster(open: ManagedSessionOpen): string {
  const profile = open.multiagent ?? open.agent['multiagent'];

  if (profile === undefined || profile === null) {
    return '';
  }

  const agents = multiagentMemberEntries(Agent, profile);

  if (agents === null) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Invalid multiagent configuration');
  }

  if (agents.length === 0) {
    return '';
  }

  const configuration = Schema.decodeUnknownSync(Installed)({
    agents,
    ownerName: open.agent['name'],
    creatorId: open.creatorId,
    memoryInstructions: open.memoryInstructions ?? '',
    childSkillInstructions: open.childSkillInstructions ?? {},
    runtimeIds: open.childRuntimeMechIds,
  });

  for (const agent of configuration.agents) {
    if (configuration.runtimeIds[agent.id] === undefined) {
      failManagedRequest(HttpStatusCode.BadRequest, 'A coordinator agent has no installed execution identity');
    }
  }

  return JSON.stringify(configuration);
}

export const decodeCoordinatorRoster = Schema.decodeUnknownSync(Schema.fromJsonString(Installed));
