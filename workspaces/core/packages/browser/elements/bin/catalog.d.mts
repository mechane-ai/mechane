type Recipe = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly story: string;
  readonly imports: ReadonlyArray<string>;
};

type PublicExport = { readonly kind: 'type' | 'value'; readonly declaration: string };

export type Catalog = {
  readonly package: string;
  readonly version: string;
  readonly recipes: ReadonlyArray<Recipe>;
  readonly entries: Readonly<Record<string, Readonly<Record<string, PublicExport>>>>;
};
