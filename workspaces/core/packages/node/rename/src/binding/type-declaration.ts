import { Array, Effect, Option } from 'effect';
import { dirname, join } from 'node:path';
import type { FileFailed } from '../errors.ts';
import { readText } from '../files/read-text.ts';
import { wordPattern } from '../word-pattern.ts';
import { declarationAts } from './declaration-ats.ts';
import type { TypeSite } from './types.ts';

/** The names an import or a re-export takes from a relative module, and that module's specifier. */
const NAMED_MODULE = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'(\.{1,2}\/[^']+)'/g;

/** A type's name, and the absolute path of the file that names it. */
type TypeDeclarationInput = { readonly name: string; readonly path: string };

/** A type's name, and a file's text. */
type NamedModuleInput = { readonly name: string; readonly text: string };

/** The names an import or a re-export takes, and its module's specifier. */
type NamedImport = { readonly names: string; readonly specifier: string };

/**
 * Where a type that a file names is declared: in the file itself, or where the relative import or re-export that takes
 * it leads, through each re-export. It is none for a type that no such module declares.
 */
export const typeDeclaration = Effect.fn('typeDeclaration')(function* ({
  name,
  path,
}: TypeDeclarationInput): Effect.fn.Return<Option.Option<TypeSite>, FileFailed> {
  const text = yield* readText({ path });
  const at = Array.head(declarationAts({ name, text }));

  if (Option.isSome(at)) {
    return Option.some({ path, at: at.value });
  }

  const specifier = namedModule({ name, text });

  if (Option.isNone(specifier)) {
    return Option.none();
  }

  return yield* typeDeclaration({ name, path: join(dirname(path), specifier.value) });
});

/** The specifier of the relative module that an import or a re-export of the file takes the name from. */
function namedModule({ name, text }: NamedModuleInput): Option.Option<string> {
  const taken = new RegExp(wordPattern({ text: name }).source);

  /** A match's names and specifier, none for a match without both. */
  const namedImport: (match: RegExpExecArray) => Option.Option<NamedImport> = ([, names, specifier]) =>
    Option.all({ names: Option.fromNullishOr(names), specifier: Option.fromNullishOr(specifier) });

  const modules = Array.getSomes([...text.matchAll(NAMED_MODULE)].map(namedImport));

  return Option.map(
    Array.findFirst(modules, ({ names }) => taken.test(names)),
    ({ specifier }) => specifier,
  );
}
