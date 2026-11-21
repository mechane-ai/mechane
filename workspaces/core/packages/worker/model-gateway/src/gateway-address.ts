import type { ModelGatewayConfiguration, ModelOffer } from './offers.ts';

const CHAT_COMPLETIONS_PATH = 'chat/completions';
const ANTHROPIC_MESSAGES_PATH = 'v1/messages?beta=true';

function anthropicGatewayBase(upstreamUrl: string): string {
  return upstreamUrl.replace(/\/$/u, '').replace(/\/v1(?:\/messages)?$/u, '');
}

export function gatewayBase(configuration: ModelGatewayConfiguration, protocol?: ModelOffer['protocol']): string {
  if (protocol === 'anthropic-messages') {
    return anthropicGatewayBase(configuration.model.upstreamUrl);
  }

  const base = new URL(configuration.model.upstreamUrl);

  if (base.pathname === '/') {
    base.pathname = '/api/v1';
  }

  return base.href.replace(/\/$/u, '');
}

export function gatewayEndpoint(configuration: ModelGatewayConfiguration, protocol?: ModelOffer['protocol']): URL {
  const prefix = gatewayBase(configuration, protocol);
  const base = new URL(`${prefix}/`);

  if (protocol === 'anthropic-messages') {
    return new URL(ANTHROPIC_MESSAGES_PATH, base);
  }

  return new URL(CHAT_COMPLETIONS_PATH, base);
}
