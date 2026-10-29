import { Array, Option } from 'effect';
import { wordPattern } from '../word-pattern.ts';

/**
 * The start of a line that declares a name at the top level, up to the name: an exported or local function, constant,
 * class, type or interface.
 */
const DECLARATION_START =
  /^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface)\s+/;

/** A binding's name, and a file's text. */
type DeclarationAtsInput = { readonly name: string; readonly text: string };

/** The start of each line of `text` that declares `name` at the top level, through the name: its rename's `at`. */
export function declarationAts({ name, text }: DeclarationAtsInput): ReadonlyArray<string> {
  const declaration = new RegExp(`${DECLARATION_START.source}${wordPattern({ text: name }).source}`);

  /** The start of the line through the name, none for a line that declares no such name. */
  const lineAt: (line: string) => Option.Option<string> = (line) =>
    Option.map(Option.fromNullishOr(declaration.exec(line)), ([at]) => at);

  return Array.getSomes(text.split('\n').map(lineAt));
}
