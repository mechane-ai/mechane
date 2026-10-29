import { Record } from 'effect';

/** Each module of the graph, with the modules it imports. */
type GraphEdge = readonly [source: string, imported: ReadonlyArray<string>];

type WithImportersInput = {
  readonly files: ReadonlyArray<string>;
  readonly graph: Readonly<Record<string, ReadonlyArray<string>>>;
};

type ImporterClosureInput = { readonly edges: ReadonlyArray<GraphEdge>; readonly reached: ReadonlyArray<string> };

/** The files and every module that imports one of them, directly or through other modules, sorted. */
export function withImporters({ files, graph }: WithImportersInput): ReadonlyArray<string> {
  const reached = importerClosure({ edges: Record.toEntries(graph), reached: [...new Set(files)] });

  return reached.toSorted();
}

/** The reached modules with every module that imports one of them, until a round reaches no other. */
function importerClosure({ edges, reached }: ImporterClosureInput): ReadonlyArray<string> {
  const isUnreachedImporter: (edge: GraphEdge) => boolean = ([source, imported]) =>
    !reached.includes(source) && imported.some((file) => reached.includes(file));

  const importers = edges.filter(isUnreachedImporter).map(([source]) => source);

  if (importers.length === 0) {
    return reached;
  }

  return importerClosure({ edges, reached: [...reached, ...importers] });
}
