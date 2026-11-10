import { Option } from 'effect';
import type { ServiceRequestInput } from './types.ts';

type ServiceRequestUrlInput = Pick<ServiceRequestInput, 'service' | 'kind' | 'requestId' | 'body'>;

/** Submissions target a collection; status reads retain their original request identity. */
export function serviceRequestUrl({ service, kind, requestId, body }: ServiceRequestUrlInput): URL {
  const url = new URL(service.url);
  const collection = url.pathname.replace(/\/$/u, '');
  const parts = [collection, encodeURIComponent(kind)];

  if (Option.isNone(body)) {
    const identity = encodeURIComponent(requestId);

    parts.push(identity);
  }

  url.pathname = parts.join('/');

  return url;
}
