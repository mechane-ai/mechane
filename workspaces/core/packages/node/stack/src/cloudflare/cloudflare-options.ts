import type { BaseConfiguration } from '@mechane/wrangler';
import { Result, Schema } from 'effect';
import type { MiniflareOptions } from 'miniflare';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { cloudflareBindings } from './cloudflare-bindings.ts';
import { cloudflareOutbound } from './cloudflare-outbound.ts';
import { RuntimeConfiguration } from './schemas.ts';
import type { CloudflareOptionsInput } from './types.ts';

const OUTBOUND_FETCH_FIELD = 'handler';

/** Uses the shipped bundle and compatibility settings with network access confined to local fixtures. */
export function cloudflareOptions({ ...input }: CloudflareOptionsInput): MiniflareOptions {
  const { base, variables, origin, contents, stateFolder, origins, provider } = input;
  const runtime = runtimeConfiguration({ base });
  const bindings = cloudflareBindings({ base, variables, runtime });
  const outbound = cloudflareOutbound({ origins, provider });

  return {
    host: origin.hostname,
    port: Number(origin.port),
    cf: false,
    telemetry: { enabled: false },
    resourcePersistencePath: stateFolder,
    workers: [
      {
        config: {
          name: base.name,
          compatibilityDate: runtime.compatibility_date,
          compatibilityFlags: [...runtime.compatibility_flags],
          manifest: { mainModule: 'worker.js', modules: { 'worker.js': { type: 'esm', contents } } },
          ...bindings,
        },
        dev: { outboundService: { type: 'fetcher', [OUTBOUND_FETCH_FIELD]: outbound } },
      },
    ],
  };
}

type RuntimeConfigurationInput = { readonly base: BaseConfiguration };

function runtimeConfiguration({ base }: RuntimeConfigurationInput): RuntimeConfiguration {
  const decoded = Schema.decodeUnknownResult(RuntimeConfiguration)(base);

  if (Result.isFailure(decoded)) {
    const failure = new StackFailed({
      step: StackStep.ReadWranglerConfiguration,
      reason: 'runtime configuration did not decode',
    });

    const refused = Result.fail(failure);

    return Result.getOrThrow(refused);
  }

  return decoded.success;
}
