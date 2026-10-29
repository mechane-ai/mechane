import { DeployFailed, DeployStep, RENDERED_FOLDER } from '@mechane/deploy-kernel';
import { JSON_INDENT_CHARS, PrivateMode, replaceFile } from '@mechane/program';
import type { BaseConfiguration } from '@mechane/wrangler';
import { Effect, Option } from 'effect';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

type WriteRenderedInput = { readonly configuration: BaseConfiguration };

/** A content-addressed path keeps another installation's render from changing a pending deployment. */
export const writeRendered = Effect.fn('writeRendered')(function* ({
  configuration,
}: WriteRenderedInput): Effect.fn.Return<string, DeployFailed> {
  const text = JSON.stringify(configuration, null, JSON_INDENT_CHARS);
  const digest = createHash('sha256').update(text).digest('hex');
  const folder = join(RENDERED_FOLDER, configuration.name);
  const path = join(folder, `wrangler-${digest}.json`);
  const step = DeployStep.WriteRenderedConfiguration;

  yield* Effect.tryPromise({
    try: () => mkdir(folder, { recursive: true }),
    catch: (cause) => new DeployFailed({ step, reason: String(cause) }),
  });

  const accept = Option.none();

  yield* replaceFile({ path, contents: text, mode: PrivateMode.File, accept }).pipe(
    Effect.mapError(({ reason }) => new DeployFailed({ step, reason })),
  );

  return path;
});
