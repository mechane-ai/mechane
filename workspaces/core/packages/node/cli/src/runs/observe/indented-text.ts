import { Option } from 'effect';
import { TEXT_INDENT } from './constants.ts';

/** Every control character but a newline and a tab, which a printed text writes as its escape, such as `\u001b`. */
const CONTROL_CHARACTERS = /[^\P{Cc}\t\n]/gu;

/** The hexadecimal digits of a `\u` escape. */
const UNICODE_ESCAPE_DIGITS = 4;

/** The radix of a `\u` escape's digits, which are hexadecimal. */
const ESCAPE_RADIX = 16;

type TextInput = { readonly text: string };

/** A control character as its `\u` escape, such as `\u001b`. */
const controlEscape: (character: string) => string = (character) => {
  // The pattern matches one character at a time, so each match has a first code point.
  const codePoint = Option.getOrThrow(Option.fromNullishOr(character.codePointAt(0)));

  return `\\u${codePoint.toString(ESCAPE_RADIX).padStart(UNICODE_ESCAPE_DIGITS, '0')}`;
};

/**
 * The text's lines, indented, with every other control character written as its escape. An inbox item's text, a model's
 * reply and a memory are anyone's, and a control sequence in them could retitle, clear or write to a terminal.
 */
export function indentedText({ text }: TextInput): ReadonlyArray<string> {
  const indented: (line: string) => string = (line) => `${TEXT_INDENT}${line}`;

  return text.replaceAll(CONTROL_CHARACTERS, controlEscape).split('\n').map(indented);
}
