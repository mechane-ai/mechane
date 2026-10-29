import type { ParsedSource } from '@mechane/modules';
import { Array, Option } from 'effect';
import type { LiteralSite } from './types.ts';

/** The quote on each side of a specifier in its module request's span. */
const QUOTE_LENGTH = 1;

/** A quote that opens a dynamic import's literal specifier, and no other expression. */
const QUOTES: ReadonlySet<string> = new Set(["'", '"']);

/** The module record of a file's parse. */
type ParsedModule = ParsedSource['parsed']['module'];

/** A module request's text and the offsets of its span, quotes and all. */
type ModuleRequest = ParsedModule['staticImports'][number]['moduleRequest'];

/** Where a statement starts. */
type StatementStart = { readonly start: number };

/** A file, and the starts of its named statements. */
type ModuleSitesInput = { readonly source: ParsedSource; readonly named: ReadonlySet<number> };

/** A file. */
type DynamicRequestsInput = { readonly source: ParsedSource };

/** The module requests of a file's static imports and exports outside its named statements, and its dynamic ones. */
export function moduleSites({ source, named }: ModuleSitesInput): ReadonlyArray<LiteralSite> {
  const { staticImports, staticExports } = source.parsed.module;

  /** Whether no named statement starts where the statement does. */
  const isUnnamed: (statement: StatementStart) => boolean = ({ start }) => !named.has(start);

  /** The module requests of an export statement's entries that name a module. */
  const exportRequests: (statement: ParsedModule['staticExports'][number]) => ReadonlyArray<ModuleRequest> = ({
    entries,
  }) => Array.getSomes(entries.map(({ moduleRequest }) => Option.fromNullishOr(moduleRequest)));

  const requests = [
    ...staticImports.filter(isUnnamed).map(({ moduleRequest }) => moduleRequest),
    ...staticExports.filter(isUnnamed).flatMap(exportRequests),
    ...dynamicRequests({ source }),
  ];

  const unique = new Map(requests.map((request) => [request.start, request]));

  return [...unique.values()].map(({ value, start, end }) => ({
    value,
    start: start + QUOTE_LENGTH,
    end: end - QUOTE_LENGTH,
    isModule: true,
  }));
}

/** The module requests of a file's dynamic imports of a literal specifier, with the specifier as their text. */
function dynamicRequests({ source }: DynamicRequestsInput): ReadonlyArray<ModuleRequest> {
  /** A dynamic import's request with its text, quotes and all. */
  const dynamicRequest: (request: ParsedModule['dynamicImports'][number]) => ModuleRequest = ({ moduleRequest }) => ({
    ...moduleRequest,
    value: source.text.slice(moduleRequest.start, moduleRequest.end),
  });

  /** Whether the request's text opens with a quote, as a literal specifier does. */
  const isLiteral: (request: ModuleRequest) => boolean = ({ value }) => QUOTES.has(value.slice(0, QUOTE_LENGTH));

  /** The request with the quotes taken off its text. */
  const unquoted: (request: ModuleRequest) => ModuleRequest = (request) => ({
    ...request,
    value: request.value.slice(QUOTE_LENGTH, -QUOTE_LENGTH),
  });

  return source.parsed.module.dynamicImports.map(dynamicRequest).filter(isLiteral).map(unquoted);
}
