import type { ModelOffer } from '../config.ts';

const anthropicPrefix = 'anthropic/';

export function publicClaudeId(id: string): string | undefined {
  if (!id.startsWith('anthropic/claude-')) {
    return undefined;
  }

  // Gateway IDs may use a dotted model version where the Claude API uses dashes.
  return id.slice(anthropicPrefix.length).replaceAll(/(?<=\d)\.(?=\d)/gu, '-');
}

export function resolveManagedModel(offers: ReadonlyArray<ModelOffer>, requestedId: string): ModelOffer | undefined {
  const exact = offers.find((offer) => offer.id === requestedId);

  if (exact !== undefined) {
    return exact;
  }

  const matches = offers.filter((offer) => publicClaudeId(offer.id) === requestedId);

  if (matches.length === 1) {
    return matches[0];
  }

  return undefined;
}

export function managedModelDefinitions(offers: ReadonlyArray<ModelOffer>): ReadonlyArray<ModelOffer> {
  const definitions = [...offers];

  for (const offer of offers) {
    const id = publicClaudeId(offer.id);

    if (id !== undefined && resolveManagedModel(offers, id) === offer) {
      definitions.push({ ...offer, id });
    }
  }

  return definitions;
}

export function matchesGatewayModel(requested: string, reported: string): boolean {
  if (requested === reported) {
    return true;
  }

  const expected = publicClaudeId(requested) ?? requested;

  if (!expected.startsWith('claude-')) {
    return false;
  }

  const served = publicClaudeId(reported) ?? reported;

  if (served === expected) {
    return true;
  }

  return served.startsWith(`${expected}-`) && /^\d{8}$/u.test(served.slice(expected.length + 1));
}
