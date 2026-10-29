const DEFAULT_HTTP_PORT = 80;

type LoopbackPortInput = { readonly origin: URL };

/** Reads the local HTTP listener port, including the default port omitted by URL normalization. */
export function loopbackPort({ origin }: LoopbackPortInput): number {
  if (origin.port.length === 0) {
    return DEFAULT_HTTP_PORT;
  }

  return Number(origin.port);
}
