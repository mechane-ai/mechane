import { Array, Predicate, Record } from 'effect';

/** A flat value of a contract's entry. */
type ValueSentenceInput = { readonly value: unknown };

/** The words of a list, each of which a sentence states in code. */
type CodeListInput = { readonly elements: ReadonlyArray<unknown> };

/**
 * A flat value as a sentence states it: a list's words in code, or `none` for an empty list. A record states each key
 * with its value, and a list there stands in brackets.
 */
export function valueSentence({ value }: ValueSentenceInput): string {
  if (Array.isArray(value)) {
    return Array.match(value, { onEmpty: () => 'none', onNonEmpty: (elements) => codeList({ elements }) });
  }

  if (Predicate.isObject(value)) {
    const fieldSentence: (field: readonly [string, unknown]) => string = ([key, field]) => {
      const stated: string = (() => {
        if (Array.isArray(field)) {
          return `[${codeList({ elements: field })}]`;
        }

        return String(field);
      })();

      return `\`${key}\` ${stated}`;
    };

    return Record.toEntries(value).map(fieldSentence).join(', ');
  }

  return String(value);
}

/** A list's words, each in code, joined by commas. */
function codeList({ elements }: CodeListInput): string {
  const inCode: (element: unknown) => string = (element) => `\`${String(element)}\``;

  return elements.map(inCode).join(', ');
}
