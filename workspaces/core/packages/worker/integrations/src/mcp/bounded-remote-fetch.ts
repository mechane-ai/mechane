import { BYTES_PER_MEBIBYTE } from '@mechane/records';
import type { FetchLike } from '@modelcontextprotocol/client';
import { Option } from 'effect';
import { boundRemoteResponse } from './bound-remote-response.ts';
import type { RemoteByteCount } from './types.ts';

const REMOTE_RESPONSE_MAX_BYTES = BYTES_PER_MEBIBYTE;

type BoundedRemoteFetchInput = { readonly signal: AbortSignal };

/** One session shares its response byte budget and never forwards credentials through redirects. */
export function boundedRemoteFetch({ signal }: BoundedRemoteFetchInput): FetchLike {
  const received = { bytes: 0 };

  const accept: (input: RemoteByteCount) => boolean = ({ bytes }) => {
    received.bytes += bytes;

    return received.bytes <= REMOTE_RESPONSE_MAX_BYTES;
  };

  const boundedFetch: FetchLike = async (url, init) => {
    const signals = [signal];

    const requestSignal = Option.fromUndefinedOr(init).pipe(
      Option.flatMap((request) => Option.fromNullishOr(request.signal)),
    );

    if (Option.isSome(requestSignal)) {
      signals.push(requestSignal.value);
    }

    const fetchSignal = AbortSignal.any(signals);
    const response = await fetch(url, { ...init, signal: fetchSignal, redirect: 'manual' });

    return await boundRemoteResponse({ response, accept });
  };

  return boundedFetch;
}
