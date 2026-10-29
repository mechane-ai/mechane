import { NodeType } from '@mechane/modules';
import { sha256Hex } from '@mechane/program';
import { Array, Option } from 'effect';
import { parseSync, Visitor } from 'oxc-parser';
import type { VariableDeclarator } from 'oxc-parser';

/** The array of schema steps a store's migrations file declares. */
const MIGRATIONS_NAME = 'MIGRATIONS';

/** A line comment, which a hash of a migration leaves out, since a reworded comment changes no stored state. */
const LINE_COMMENT = /\/\/[^\n]*/g;

/** A run of whitespace, which a hash of a migration reads as one space, so formatting changes no hash. */
const WHITESPACE = /\s+/g;

/** A store's migrations file, by its path, and its text. */
type StoreHashesInput = { readonly path: string; readonly text: string };

/** Each entry of the store's `MIGRATIONS`, by its position and the hash of its code without its comments. */
export function storeHashes({ path, text }: StoreHashesInput): ReadonlyArray<string> {
  const { program } = parseSync(path, text, { sourceType: 'module', lang: 'ts' });
  const steps: Array<string> = [];

  /** Keeps the text of each element of the `MIGRATIONS` array, one schema step each. */
  const keepSteps: (node: VariableDeclarator) => void = (node) => {
    const init = Option.fromNullishOr(node.init);

    if (node.id.type !== NodeType.Identifier || node.id.name !== MIGRATIONS_NAME) {
      return;
    }

    if (Option.isNone(init) || init.value.type !== NodeType.ArrayExpression) {
      return;
    }

    const elements = Array.getSomes(init.value.elements.map(Option.fromNullishOr));

    steps.push(...elements.map((element) => text.slice(element.start, element.end)));
  };

  new Visitor({ VariableDeclarator: keepSteps }).visit(program);

  /** A step's entry: its position and the hash of its code, without comments and with each run of space as one. */
  const stepEntry: (step: string, index: number) => string = (step, index) => {
    const code = step.replaceAll(LINE_COMMENT, '').replaceAll(WHITESPACE, ' ');

    return `${index} ${sha256Hex({ contents: code })}`;
  };

  return steps.map(stepEntry);
}
