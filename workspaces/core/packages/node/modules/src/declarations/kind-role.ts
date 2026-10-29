import { Array, Option } from 'effect';
import { NodeType, RoleFile } from '../constants.ts';
import type { TopLevelDeclaration } from '../types.ts';
import { constantValue } from './constant-value.ts';
import { isTypeDeclaration } from './is-type-declaration.ts';
import { valueRole } from './value-role.ts';

/** The superclass a tagged error extends, as the source writes it. */
const TAGGED_ERROR = 'TaggedError';

/** A unit's declarations under its name, and its file's text. */
type KindRoleInput = { readonly entries: ReadonlyArray<TopLevelDeclaration>; readonly text: string };

/**
 * The role file a unit's kind belongs in: `types` for types alone, and `errors` for a tagged error. A constant built
 * from a schema's root belongs in `schemas`, and one written as a literal, an object, an array or a new collection
 * without a function in `constants`. Any other value belongs in no role file.
 */
export function kindRole({ entries, text }: KindRoleInput): Option.Option<RoleFile> {
  /** Whether the entry declares a value rather than a type alone. */
  const isValue: (entry: TopLevelDeclaration) => boolean = ({ declaration }) => !isTypeDeclaration({ declaration });
  const value = Array.findFirst(entries, isValue);

  if (Option.isNone(value)) {
    return Option.some(RoleFile.Types);
  }

  const { declaration } = value.value;

  if (declaration.type === NodeType.ClassDeclaration) {
    const superClass = Option.map(Option.fromNullishOr(declaration.superClass), ({ start, end }) =>
      text.slice(start, end),
    );

    return Option.as(
      Option.filter(superClass, (written) => written.includes(TAGGED_ERROR)),
      RoleFile.Errors,
    );
  }

  return Option.flatMap(constantValue({ declaration }), (expression) => valueRole({ expression, text }));
}
