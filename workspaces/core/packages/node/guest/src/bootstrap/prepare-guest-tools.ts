import { SANDBOX_TOOL_LIMITS, SandboxToolTarget } from '@mechane/sandbox-wire';
import type { SandboxTools } from '@mechane/sandbox-wire';
import { Duration, Effect, Option, Schema } from 'effect';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { certificateEnvironment } from '../certificate-environment.ts';
import { GuestMisconfigured } from '../errors.ts';
import type { GuestSettings } from '../types.ts';
import { installGuestTool } from './install-guest-tool.ts';

const TOOL_DIRECTORY_MODE = 0o700;
const TOOL_STARTUP_TIMEOUT = Duration.seconds(SANDBOX_TOOL_LIMITS.startupSeconds);
const ToolTarget = Schema.Enum(SandboxToolTarget);

const TOOL_STARTUP_BOUND = Effect.timeoutOrElse({
  duration: TOOL_STARTUP_TIMEOUT,
  orElse: () => new GuestMisconfigured({ reason: 'tool bootstrap exceeded its startup deadline' }),
});

type PrepareGuestToolsInput = {
  readonly tools: SandboxTools;
  readonly target: string;
  readonly folder: string;
  readonly path: string;
  readonly trustedCertificatesPem: GuestSettings['trustedCertificatesPem'];
};

/** The caller owns the private scratch folder until the guest and all its commands stop. */
export const prepareGuestTools = Effect.fn('prepareGuestTools')(function* ({
  tools,
  target,
  folder,
  path,
  trustedCertificatesPem,
}: PrepareGuestToolsInput): Effect.fn.Return<string, GuestMisconfigured> {
  const toolsFolder = join(folder, 'tools');
  const bin = join(toolsFolder, 'bin');

  yield* Effect.tryPromise({
    try: () => mkdir(bin, { recursive: true, mode: TOOL_DIRECTORY_MODE }),
    catch: () => new GuestMisconfigured({ reason: 'create managed tool directory failed' }),
  });

  if (tools.length === 0) {
    return bin;
  }

  const platform = yield* Schema.decodeUnknownEffect(ToolTarget, { onExcessProperty: 'error' })(target).pipe(
    Effect.mapError(() => new GuestMisconfigured({ reason: `tool bootstrap does not support ${target}` })),
  );

  const environment: () => Readonly<Record<string, string>> = () => ({
    PATH: path,
    HOME: toolsFolder,
    LANG: 'C.UTF-8',
    ...certificateEnvironment({ scratchDirectory: folder, trustedCertificatesPem }),
  });

  for (const tool of tools) {
    const archive = Option.fromUndefinedOr(tool.targets[platform]);

    if (Option.isNone(archive)) {
      return yield* new GuestMisconfigured({ reason: `${tool.name} has no archive for ${platform}` });
    }

    yield* installGuestTool({ tool, archive: archive.value, folder: toolsFolder, bin, environment });
  }

  return bin;
}, TOOL_STARTUP_BOUND);
