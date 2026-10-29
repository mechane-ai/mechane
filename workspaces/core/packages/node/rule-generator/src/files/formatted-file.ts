import { CONTRACTS } from '@mechane/rules';
import type { GeneratedFile } from '@mechane/rules';
import { Effect } from 'effect';
import { format } from 'oxfmt';
import { GenerateStep } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';

type FormattedFileInput = { readonly file: GeneratedFile };

/** A generated file as the formatter lays it out, with the formatter options the registry declares. */
export const formattedFile = Effect.fn('formattedFile')(function* ({
  file,
}: FormattedFileInput): Effect.fn.Return<GeneratedFile, GenerateFailed> {
  const { path, text } = file;
  const { formatter } = CONTRACTS['code-comment-form'].values;
  // oxfmt's `format` takes each import group as a list; a group of one sorts as its name alone does.
  const sortImports = { ...formatter.sortImports, groups: formatter.sortImports.groups.map((group) => [group].flat()) };

  const { code, errors } = yield* Effect.tryPromise({
    try: () => format(path, text, { ...formatter, sortImports }),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Format, path, reason: String(cause) }),
  });

  if (errors.length > 0) {
    return yield* new GenerateFailed({
      step: GenerateStep.Format,
      path,
      reason: errors.map(({ message }) => message).join('; '),
    });
  }

  return { path, text: code };
});
