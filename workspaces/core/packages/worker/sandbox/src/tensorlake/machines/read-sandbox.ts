import { HttpStatusCode } from '@mechane/records';
import { Option, Result } from 'effect';
import { TensorlakeRefused } from '../errors.ts';
import type { TensorlakeSettings } from '../types.ts';
import { inspectRemote } from './inspect-remote.ts';
import { sandboxUrl } from './sandbox-url.ts';
import type { Remote } from './schemas.ts';

type BoundRemote = Remote & {
  /** None while the provider has no reachable guest endpoint. */
  readonly origin: Option.Option<URL>;
};

/** A missing saved VM fails closed; only explicit maintenance may replace its binding. */
export async function readSandbox({ apiKey, name, store }: TensorlakeSettings): Promise<Option.Option<BoundRemote>> {
  const bound = store.remoteSandbox();
  const identity = Option.getOrElse(bound, () => name);
  const found = await inspectRemote({ apiKey, name: identity });

  if (Option.isNone(found)) {
    if (Option.isSome(bound)) {
      const url = sandboxUrl({ name: identity });
      const failure = new TensorlakeRefused({ url, status: HttpStatusCode.NotFound });

      const refused = Result.fail(failure);

      return Result.getOrThrow(refused);
    }

    return Option.none();
  }

  store.bindRemoteSandbox({ sandboxId: found.value.id });

  return Option.some({ ...found.value, origin: found.value.sandbox_url });
}
