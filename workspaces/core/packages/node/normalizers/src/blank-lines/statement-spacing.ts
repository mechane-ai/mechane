import { NodeType } from '@mechane/modules';
import type { ListedStatement } from '@mechane/modules';
import { Predicate } from 'effect';
import type { Expression } from 'oxc-parser';
import { Spacing } from './constants.ts';

/** The statements that stand apart at any length: control flow, a return and a throw. */
const APART: ReadonlySet<ListedStatement['type']> = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
  'ReturnStatement',
  'ThrowStatement',
]);

/** The expressions a call statement runs, besides a `yield*`: a call, `new` and `await`. */
const CALLS: ReadonlySet<Expression['type']> = new Set(['CallExpression', 'NewExpression', 'AwaitExpression']);

/** The declarations and the expression statements that stand apart once they span several lines. */
const SPANNING: ReadonlySet<ListedStatement['type']> = new Set([
  'VariableDeclaration',
  'FunctionDeclaration',
  'ClassDeclaration',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'ExportDefaultDeclaration',
  'ExpressionStatement',
]);

/** The operator that discards a value, as in `void flush()`, which leaves its statement a call statement. */
const DISCARD_OPERATOR = 'void';

/** A statement, and the text of its file. */
type StatementSpacingInput = { readonly statement: ListedStatement; readonly text: string };

type RunsCallInput = { readonly statement: ListedStatement };

/**
 * How a statement stands among its neighbors: by its kind, an exported declaration by what it declares, and a
 * declaration or expression statement by whether it spans several lines. An import, a re-export, a list of exported
 * names, a `break` and a one-line assignment are loose at any length.
 */
export function statementSpacing({ statement, text }: StatementSpacingInput): Spacing {
  if (APART.has(statement.type)) {
    return Spacing.Apart;
  }

  if (runsCall({ statement })) {
    return Spacing.Call;
  }

  const kind: ListedStatement['type'] = (() => {
    if (statement.type === NodeType.ExportNamedDeclaration && Predicate.isNotNull(statement.declaration)) {
      return statement.declaration.type;
    }

    return statement.type;
  })();

  if (kind === NodeType.FunctionSignature) {
    return Spacing.Overload;
  }

  if (SPANNING.has(kind) && text.slice(statement.start, statement.end).includes('\n')) {
    return Spacing.Apart;
  }

  return Spacing.Loose;
}

/**
 * Whether a statement only runs a call, `new`, `await` or `yield*`, through a `void` and an optional chain. A `yield*`
 * statement is the Effect dialect's `await`.
 */
function runsCall({ statement }: RunsCallInput): boolean {
  if (statement.type !== NodeType.ExpressionStatement) {
    return false;
  }

  const { expression } = statement;

  const kept: Expression = (() => {
    if (expression.type === NodeType.UnaryExpression && expression.operator === DISCARD_OPERATOR) {
      return expression.argument;
    }

    return expression;
  })();

  const run: Expression = (() => {
    if (kept.type === NodeType.ChainExpression) {
      return kept.expression;
    }

    return kept;
  })();

  return CALLS.has(run.type) || (run.type === NodeType.YieldExpression && run.delegate);
}
