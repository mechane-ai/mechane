import { decodeJsonc } from '@mechane/wrangler';
import { Effect } from 'effect';
import type { Schema } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { DistributionSettings } from '../types.ts';
import { runCommand } from './run-command.ts';

type ArchiveDocumentInput<S extends Schema.Codec<unknown, unknown>> = {
  readonly path: string;
  readonly entry: string;
  readonly schema: S;
  readonly settings: DistributionSettings;
};

/** Decodes one named OCI document without extracting archive paths onto the filesystem. */
export const archiveDocument = Effect.fn('archiveDocument')(function* <S extends Schema.Codec<unknown, unknown>>({
  path,
  entry,
  schema,
  settings,
}: ArchiveDocumentInput<S>): Effect.fn.Return<S['Type'], DistributionFailed, S['DecodingServices']> {
  const text = yield* runCommand({ command: 'tar', args: ['-xOf', path, entry], settings });

  return yield* decodeJsonc({
    text,
    schema,
    options: {},
    step: DistributionStep.Verify,
    subjects: [],
    failure: DistributionFailed,
  });
});
