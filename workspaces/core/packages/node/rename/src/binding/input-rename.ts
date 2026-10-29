import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Effect, Option } from 'effect';
import { relative } from 'node:path';
import type { FileFailed } from '../errors.ts';
import type { BindingRename, IdentifierRename } from '../types.ts';
import { wordPattern } from '../word-pattern.ts';
import { typeDeclaration } from './type-declaration.ts';
import type { DeclaringFile, TypeSite } from './types.ts';

/** The suffix of a function's input type, which follows the function's name in Pascal case. */
const INPUT_SUFFIX = 'Input';

/** A function's name. */
type NameInput = { readonly name: string };

/** The binding, and the file that declares it. */
type InputRenameInput = { readonly binding: BindingRename; readonly declared: DeclaringFile };

/** The rename of the binding's input type, `<From>Input` to `<To>Input`, when the declaring file names that type. */
export const inputRename = Effect.fn('inputRename')(function* ({
  binding,
  declared,
}: InputRenameInput): Effect.fn.Return<Option.Option<IdentifierRename>, FileFailed> {
  const from = inputName({ name: binding.from });

  if (!new RegExp(wordPattern({ text: from }).source).test(declared.text)) {
    return Option.none();
  }

  const site = yield* typeDeclaration({ name: from, path: declared.path });
  const to = inputName({ name: binding.to });

  /** The input type's rename from its declaring line. */
  const typeRename: (typeSite: TypeSite) => IdentifierRename = ({ path, at }) => ({
    file: relative(WORKSPACE_FOLDER, path),
    at,
    from,
    to,
  });

  return Option.map(site, typeRename);
});

/** A function's input type: its name in Pascal case with the input suffix, such as `ShowDroneInput`. */
function inputName({ name }: NameInput): string {
  return `${name.slice(0, 1).toUpperCase()}${name.slice(1)}${INPUT_SUFFIX}`;
}
