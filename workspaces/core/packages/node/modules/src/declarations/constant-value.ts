import { Array, Option } from 'effect';
import type { Declaration, Expression } from 'oxc-parser';
import { NodeType } from '../constants.ts';

type ConstantValueInput = { readonly declaration: Declaration };

type ExpressionInput = { readonly expression: Expression };

/** The expression a movable constant is initialized with, without the `as` or `satisfies` around it. */
export function constantValue({ declaration }: ConstantValueInput): Option.Option<Expression> {
  if (declaration.type !== NodeType.VariableDeclaration) {
    return Option.none();
  }

  const init = Option.flatMapNullishOr(Array.head(declaration.declarations), ({ init: value }) => value);

  return Option.map(init, (expression) => unwrapped({ expression }));
}

/** The expression inside every `as` and `satisfies`. */
function unwrapped({ expression }: ExpressionInput): Expression {
  if (expression.type === NodeType.AsExpression || expression.type === NodeType.SatisfiesExpression) {
    return unwrapped({ expression: expression.expression });
  }

  return expression;
}
