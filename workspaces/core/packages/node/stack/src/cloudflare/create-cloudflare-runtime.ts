import { Miniflare } from 'miniflare';
import type { MiniflareOptions } from 'miniflare';

type CreateCloudflareRuntimeInput = { readonly options: MiniflareOptions };

/** Constructs workerd from the local fixture configuration. */
export function createCloudflareRuntime({ options }: CreateCloudflareRuntimeInput): Miniflare {
  return new Miniflare(options);
}
