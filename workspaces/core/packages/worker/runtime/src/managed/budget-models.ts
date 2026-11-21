import { failManagedRequest, resolveManagedModel } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { multiagentMemberEntries } from './multiagent.ts';

const AgentModel = Schema.Struct({
  model: Schema.Union([
    Schema.String,
    Schema.Struct({ id: Schema.String, speed: Schema.optional(Schema.Literals(['standard', 'fast'])) }),
  ]),
});

function requireListPrice(configuration: RuntimeConfiguration, agent: unknown): void {
  if (!Schema.is(AgentModel)(agent)) {
    failManagedRequest(HttpStatusCode.BadRequest, 'No list price is available for an unresolved session model');
  }

  const id: string = (() => {
    if (typeof agent.model === 'string') {
      return agent.model;
    }

    return agent.model.id;
  })();

  const offer = resolveManagedModel(configuration.model.offers, id);
  const isFast = typeof agent.model === 'object' && agent.model.speed === 'fast';
  let price = offer?.listPrice;

  if (isFast) {
    price = offer?.fastPricing?.listPrice;
  }

  if (price === undefined) {
    failManagedRequest(HttpStatusCode.BadRequest, `No list price is available for ${id}`);
  }
}

export function assertManagedBudgetModels(
  configuration: RuntimeConfiguration,
  agent: Readonly<Record<string, unknown>>,
): void {
  requireListPrice(configuration, agent);

  const roster = agent['multiagent'];

  if (roster === null || roster === undefined) {
    return;
  }

  const members = multiagentMemberEntries(AgentModel, roster);

  if (members === null) {
    failManagedRequest(HttpStatusCode.BadRequest, 'A session budget requires a resolved roster of predefined agents');
  }

  for (const child of members) {
    requireListPrice(configuration, child);
  }
}
