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
  readonly format?: 'zip' | undefined;
};

/** Metadata is decoded without allowing an archive to write filesystem paths. */
export const archiveDocument = Effect.fn('archiveDocument')(function* <S extends Schema.Codec<unknown, unknown>>({
  path,
  entry,
  schema,
  settings,
  format,
}: ArchiveDocumentInput<S>): Effect.fn.Return<S['Type'], DistributionFailed, S['DecodingServices']> {
  const reader = { command: 'tar', args: ['-xOf', path, entry] };

  if (format === 'zip') {
    reader.command = 'unzip';
    reader.args = ['-p', path, entry];
  }

  const text = yield* runCommand({ ...reader, settings });

  return yield* decodeJsonc({
    text,
    schema,
    options: {},
    step: DistributionStep.Verify,
    subjects: [],
    failure: DistributionFailed,
  });
});
