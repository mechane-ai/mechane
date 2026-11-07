import type { RequestService } from '@mechane/protocol';

type RequestServiceKeyInput = { readonly service: RequestService };

/** A pending wait fails if either its configured service or its credential reference changes. */
export function requestServiceKey({ service }: RequestServiceKeyInput): string {
  return `${service.url.href}\n${service.secretReference}`;
}
