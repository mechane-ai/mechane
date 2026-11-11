import { InputUnreadable, parsedText, readText } from '@mechane/checks-kernel';
import { moduleStatements, NodeType } from '@mechane/modules';
import type { ModuleStatement, ParsedSource } from '@mechane/modules';
import { Effect, Option, Record, Schema } from 'effect';
import { CATALOG_NAME, PROPERTY_NODE } from './constants.ts';

const SMOKE_CATALOG = 'packages/node/smoke/src/catalog.ts';
export const SMOKE_SOURCE = 'packages/node/smoke/src/';

export type SmokeScenario = { readonly family: string; readonly guarantee: string; readonly entry: string };

type SourceStatement = ParsedSource['parsed']['program']['body'][number];
type VariableNode = { readonly type: typeof NodeType.VariableDeclaration };
type ArrayNode = { readonly type: typeof NodeType.ArrayExpression };
type SourceVariable = Extract<SourceStatement, VariableNode>;
type SourceExpression = NonNullable<SourceVariable['declarations'][number]['init']>;
type CatalogArray = Extract<SourceExpression, ArrayNode>;

type CatalogScenarioInput = {
  readonly entry: CatalogArray['elements'][number];
  readonly imports: ReadonlyArray<ModuleStatement>;
};

const CatalogFields = Schema.Struct({
  family: Schema.NonEmptyString,
  guarantee: Schema.NonEmptyString,
  run: Schema.NonEmptyString,
});

/** The selector reads metadata without importing the smoke's runtime and its dependency graph. */
export const smokeCatalog = Effect.fn('smokeCatalog')(function* (): Effect.fn.Return<
  ReadonlyArray<SmokeScenario>,
  InputUnreadable
> {
  const text = yield* readText({ path: SMOKE_CATALOG });
  const source = parsedText({ path: SMOKE_CATALOG, text });
  const imports = moduleStatements({ source });

  const declarations = source.parsed.program.body.flatMap((statement) => {
    if (statement.type !== NodeType.ExportNamedDeclaration) {
      return [];
    }

    const declaration = Option.fromNullishOr(statement.declaration);

    if (Option.isNone(declaration) || declaration.value.type !== NodeType.VariableDeclaration) {
      return [];
    }

    return declaration.value.declarations;
  });

  const found = declarations.find(({ id }) => id.type === NodeType.Identifier && id.name === CATALOG_NAME);
  const catalog = Option.fromNullishOr(found);

  if (Option.isNone(catalog)) {
    return yield* catalogUnreadable();
  }

  const satisfies = Option.fromNullishOr(catalog.value.init);

  if (Option.isNone(satisfies) || satisfies.value.type !== NodeType.SatisfiesExpression) {
    return yield* catalogUnreadable();
  }

  const assertion = satisfies.value.expression;

  if (assertion.type !== NodeType.AsExpression) {
    return yield* catalogUnreadable();
  }

  const entries = assertion.expression;

  if (entries.type !== NodeType.ArrayExpression || entries.elements.length === 0) {
    return yield* catalogUnreadable();
  }

  return yield* Effect.forEach(entries.elements, (entry) => catalogScenario({ entry, imports }), { concurrency: 1 });
});

const catalogScenario = Effect.fn('catalogScenario')(function* ({
  entry,
  imports,
}: CatalogScenarioInput): Effect.fn.Return<SmokeScenario, InputUnreadable> {
  const candidate = Option.fromNullishOr(entry);

  if (Option.isNone(candidate) || candidate.value.type !== NodeType.ObjectExpression) {
    return yield* catalogUnreadable();
  }

  const fields = candidate.value.properties.flatMap((property) => {
    if (property.type !== PROPERTY_NODE || property.key.type !== NodeType.Identifier) {
      return [];
    }

    if (property.value.type === NodeType.Literal) {
      return [[property.key.name, property.value.value] as const];
    }

    if (property.value.type === NodeType.Identifier) {
      return [[property.key.name, property.value.name] as const];
    }

    return [];
  });

  const values = Record.fromEntries(fields);

  const decoded = yield* Schema.decodeUnknownEffect(CatalogFields)(values).pipe(
    Effect.mapError(() => catalogUnreadable()),
  );

  const matched = imports.find(({ names }) => names.some(({ local }) => local === decoded.run));
  const imported = Option.fromNullishOr(matched);

  if (Option.isNone(imported)) {
    return yield* catalogUnreadable();
  }

  const target = imported.value.target;

  if (Option.isNone(target) || !target.value.startsWith(SMOKE_SOURCE)) {
    return yield* catalogUnreadable();
  }

  return { family: decoded.family, guarantee: decoded.guarantee, entry: target.value };
});

function catalogUnreadable(): InputUnreadable {
  return new InputUnreadable({
    path: SMOKE_CATALOG,
    reason: 'declare each scenario with a literal family, guarantee, and imported run function',
  });
}
