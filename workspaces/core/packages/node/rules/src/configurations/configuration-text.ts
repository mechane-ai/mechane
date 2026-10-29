import { IDENTIFIER } from '@mechane/rule-shapes';
import { Option, Predicate, Record } from 'effect';
import { Syntax } from '../constants.ts';
import type { ConfigurationNote } from './types.ts';

type ConfigurationTextInput = {
  readonly value: unknown;
  readonly notes: ReadonlyArray<ConfigurationNote>;
  /** The paths of the objects to write open, each on lines of its own, whatever they hold. */
  readonly expanded: ReadonlyArray<ReadonlyArray<string>>;
  readonly syntax: Syntax;
};

/** One value of a configuration, the keys that lead to it, and the comments of every noted key. */
type ValueTextInput = {
  readonly value: unknown;
  readonly path: ReadonlyArray<string>;
  readonly comments: Readonly<Record<string, ReadonlyArray<string>>>;
  /** The paths of the objects a note lies inside, which the text writes open. */
  readonly openPaths: ReadonlySet<string>;
  readonly syntax: Syntax;
};

/**
 * A configuration as JSON or as a JavaScript object literal, with each note's lines as comments above its key. An
 * object that holds a note, and each object at an `expanded` path, is written open; the formatter lays out the rest.
 */
export function configurationText({ value, notes, expanded, syntax }: ConfigurationTextInput): string {
  const commentEntry: (note: ConfigurationNote) => readonly [string, ReadonlyArray<string>] = ({ path, lines }) => [
    JSON.stringify(path),
    lines,
  ];

  const comments = Record.fromEntries(notes.map(commentEntry));

  const enclosingPaths: (note: ConfigurationNote) => ReadonlyArray<string> = ({ path }) => {
    const enclosingPath: (key: string, depth: number) => string = (_key, depth) => JSON.stringify(path.slice(0, depth));

    return path.map(enclosingPath);
  };

  const openPaths = new Set([...notes.flatMap(enclosingPaths), ...expanded.map((path) => JSON.stringify(path))]);

  return valueText({ value, path: [], comments, openPaths, syntax });
}

/** One value's text; an array or object holds the text of each of its elements or fields. */
function valueText({ value, path, comments, openPaths, syntax }: ValueTextInput): string {
  if (Array.isArray(value)) {
    const elementText: (element: unknown, index: number) => string = (element, index) =>
      valueText({ value: element, path: [...path, String(index)], comments, openPaths, syntax });

    return `[${value.map(elementText).join(', ')}]`;
  }

  if (!Predicate.isObject(value)) {
    return JSON.stringify(value);
  }

  const fieldText: (field: readonly [string, unknown]) => string = ([key, field]) => {
    const keyPath = [...path, key];
    const lines = Option.getOrElse(Record.get(comments, JSON.stringify(keyPath)), () => []);
    const commentLine: (line: string) => string = (line) => `// ${line}\n`;

    const keyText: string = (() => {
      if (syntax === Syntax.JavaScript && IDENTIFIER.test(key)) {
        return key;
      }

      return JSON.stringify(key);
    })();

    return `${lines.map(commentLine).join('')}${keyText}: ${valueText({ value: field, path: keyPath, comments, openPaths, syntax })}`;
  };

  const entries = Record.toEntries(value).map(fieldText);

  if (!openPaths.has(JSON.stringify(path))) {
    return `{ ${entries.join(', ')} }`;
  }

  return `{\n${entries.join(',\n')}\n}`;
}
