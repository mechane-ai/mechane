import { Visitor } from 'oxc-parser';
import type { VisitorObject } from 'oxc-parser';
import type { ParsedSource, Reference, StatementSpan } from '../types.ts';
import { isWithin } from './is-within.ts';
import { keyOffsets } from './key-offsets.ts';
import { namedPartOffsets } from './named-part-offsets.ts';
import { typeSpans } from './type-spans.ts';
import type { ProgramInput } from './types.ts';

/** A file, and the spans of its imports and re-exports, whose identifiers name no binding of the file. */
type ReferenceSitesInput = { readonly source: ParsedSource; readonly modules: ReadonlyArray<StatementSpan> };

/** An identifier's name and offset. */
type IdentifierSite = { readonly name: string; readonly offset: number };

/**
 * Each identifier of the file outside its imports and re-exports that can name a binding, and whether it stands in a
 * type. An uncomputed key, a member's property and a qualified name's right part name no binding.
 */
export function referenceSites({ source, modules }: ReferenceSitesInput): ReadonlyArray<Reference> {
  const { program } = source.parsed;
  const parts: ReadonlySet<number> = new Set([...keyOffsets({ program }), ...namedPartOffsets({ program })]);
  const types = typeSpans({ program });

  /** Whether the identifier can name a binding: it is no part and stands outside the imports and re-exports. */
  const isReference: (site: IdentifierSite) => boolean = ({ offset }) =>
    !parts.has(offset) && !isWithin({ spans: modules, offset });

  /** The identifier as a reference, standing in a type or not. */
  const reference: (site: IdentifierSite) => Reference = ({ name, offset }) => ({
    name,
    offset,
    isType: isWithin({ spans: types, offset }),
  });

  return identifierSites({ program }).filter(isReference).map(reference);
}

/** Each identifier of the program, with its name and offset. */
function identifierSites({ program }: ProgramInput): ReadonlyArray<IdentifierSite> {
  const sites: Array<IdentifierSite> = [];

  /** Keeps an identifier's name and offset. */
  const keepIdentifier: NonNullable<VisitorObject['Identifier']> = (node) => {
    sites.push({ name: node.name, offset: node.start });
  };

  new Visitor({ Identifier: keepIdentifier }).visit(program);

  return sites;
}
