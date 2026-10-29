import { Option } from 'effect';
import type { Expression } from 'oxc-parser';
import { NodeType, RoleFile } from '../constants.ts';

/** The names a schema's expression starts from: Effect's `Schema`, TypeBox's `Type` and the protocol's wire structs. */
const SCHEMA_ROOTS: ReadonlySet<string> = new Set(['Schema', 'Type', 'wireStruct', 'renamedWireStruct']);

/** Text that holds a function, which keeps a constant out of a constants file. */
const FUNCTION_TEXT = /[=]>|\bfunction\b/;

/** The expressions a constant is written as when it belongs in a constants file, unless a function sits inside. */
const CONSTANT_EXPRESSIONS: ReadonlySet<string> = new Set([
  NodeType.Literal,
  NodeType.TemplateLiteral,
  NodeType.ObjectExpression,
  NodeType.ArrayExpression,
  NodeType.ConstructorCall,
  NodeType.UnaryExpression,
]);

/** A constant's expression, and its file's text. */
type ValueRoleInput = { readonly expression: Expression; readonly text: string };

type ExpressionInput = { readonly expression: Expression };

/** A constant's role: a schema by its root's name, or a constant by how it is written. */
export function valueRole({ expression, text }: ValueRoleInput): Option.Option<RoleFile> {
  if (Option.exists(rootName({ expression }), (name) => SCHEMA_ROOTS.has(name))) {
    return Option.some(RoleFile.Schemas);
  }

  if (CONSTANT_EXPRESSIONS.has(expression.type) && !FUNCTION_TEXT.test(text.slice(expression.start, expression.end))) {
    return Option.some(RoleFile.Constants);
  }

  return Option.none();
}

/** The name a chain of calls and members starts from, such as `Schema` for `Schema.String.pipe(…)`. */
function rootName({ expression }: ExpressionInput): Option.Option<string> {
  if (expression.type === NodeType.Identifier) {
    return Option.some(expression.name);
  }

  if (expression.type === NodeType.CallExpression) {
    return rootName({ expression: expression.callee });
  }

  if (expression.type === NodeType.MemberExpression) {
    return rootName({ expression: expression.object });
  }

  return Option.none();
}
