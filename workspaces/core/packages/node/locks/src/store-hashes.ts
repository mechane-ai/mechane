import { NodeType } from '@mechane/modules';
import { sha256Hex } from '@mechane/program';
import { Array, Option } from 'effect';
import { parseSync, Visitor } from 'oxc-parser';
import type { Expression, VariableDeclarator } from 'oxc-parser';

/** Source positions and spelling do not change a migration's behavior; literal values remain part of the hash. */
const SOURCE_METADATA: ReadonlySet<string> = new Set(['start', 'end', 'loc', 'range', 'raw']);

/** A store's migrations file, by its path, and its text. */
type StoreHashesInput = { readonly path: string; readonly text: string; readonly declaration: string };

type ExpressionInput = { readonly expression: Expression };

/** Each declared step is hashed without source positions, retaining string and SQL contents exactly. */
export function storeHashes({ path, text, declaration }: StoreHashesInput): ReadonlyArray<string> {
  const { program } = parseSync(path, text, { sourceType: 'module', lang: 'ts' });
  const steps: Array<string> = [];

  const keepSteps: (node: VariableDeclarator) => void = (node) => {
    const init = Option.fromNullishOr(node.init);

    if (node.id.type !== NodeType.Identifier || node.id.name !== declaration || Option.isNone(init)) {
      return;
    }

    const expression = migrationExpression({ expression: init.value });

    if (expression.type !== NodeType.ArrayExpression) {
      return;
    }

    const elements = Array.getSomes(expression.elements.map(Option.fromNullishOr));

    const serialized = elements.map((element) => JSON.stringify(element, omitSourceMetadata));

    steps.push(...serialized);
  };

  new Visitor({ VariableDeclarator: keepSteps }).visit(program);

  const stepEntry: (step: string, index: number) => string = (step, index) =>
    `${index} ${sha256Hex({ contents: step })}`;

  return steps.map(stepEntry);
}

const omitSourceMetadata: (key: string, value: unknown) => unknown = (key, value) => {
  if (SOURCE_METADATA.has(key)) {
    return;
  }

  return value;
};

function migrationExpression({ expression }: ExpressionInput): Expression {
  if (expression.type === NodeType.AsExpression) {
    return expression.expression;
  }

  if (expression.type === NodeType.SatisfiesExpression) {
    return expression.expression;
  }

  return expression;
}
