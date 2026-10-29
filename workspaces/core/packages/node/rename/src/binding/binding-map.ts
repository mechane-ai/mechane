import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Effect, Option } from 'effect';
import { relative } from 'node:path';
import type { DeclarationMissing, DeclarationShared, FileFailed, MoveTaken } from '../errors.ts';
import { workspaceSources } from '../files/workspace-sources.ts';
import type { RenameMap } from '../schemas.ts';
import type { BindingRename, StringRename } from '../types.ts';
import { declaringFile } from './declaring-file.ts';
import { inputRename } from './input-rename.ts';
import { stemMove } from './stem-move.ts';

/** The call that names an `Effect.fn` span, whose name a binding's rename changes with the binding's. */
const SPAN_CALL = 'Effect.fn';

/** The binding the command line names. */
type BindingMapInput = { readonly binding: BindingRename };

/** The binding, its file's text, and the file's path once the rename moved it, relative to the workspace. */
type SpanRenamesInput = { readonly binding: BindingRename; readonly text: string; readonly within: string };

/**
 * The map that renames one binding: its declarations in the one file that declares it, and its input type. It moves the
 * file named for it, with every relative import of that file, and renames its `Effect.fn` span name.
 */
export const bindingMap = Effect.fn('bindingMap')(function* ({
  binding,
}: BindingMapInput): Effect.fn.Return<RenameMap, FileFailed | DeclarationMissing | DeclarationShared | MoveTaken> {
  const files = yield* workspaceSources();
  const declared = yield* declaringFile({ binding, files });
  const input = yield* inputRename({ binding, declared });
  const file = relative(WORKSPACE_FOLDER, declared.path);
  const move = yield* stemMove({ binding, file, files });
  const declarations = declared.ats.map((at) => ({ file, at, from: binding.from, to: binding.to }));

  return {
    identifiers: [...declarations, ...Option.toArray(input)],
    files: Option.toArray(move),
    strings: spanRenames({
      binding,
      text: declared.text,
      within: Option.getOrElse(
        Option.map(move, ({ to }) => to),
        () => file,
      ),
    }),
  };
});

/** The rename of the binding's `Effect.fn` span name in its file, which no compiler reads as a reference. */
function spanRenames({ binding, text, within }: SpanRenamesInput): ReadonlyArray<StringRename> {
  const from = `${SPAN_CALL}('${binding.from}')`;

  if (!text.includes(from)) {
    return [];
  }

  return [{ from, to: `${SPAN_CALL}('${binding.to}')`, within: Option.some(within) }];
}
