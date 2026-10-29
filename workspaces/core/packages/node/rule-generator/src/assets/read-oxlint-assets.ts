import { RuleTool } from '@mechane/rule-shapes';
import type { AssetEntry } from '@mechane/rules';
import { Array, Effect, Schema } from 'effect';
import { GenerateStep } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';
import { readInput } from '../files/read-input.ts';
import type { InstalledOxlintFile } from './types.ts';

/** An installed oxlint file as JSON, of which the registry reads the value it gives each rule, by the rule's name. */
const OxlintFileJson = Schema.fromJsonString(Schema.Struct({ rules: Schema.Record(Schema.String, Schema.Unknown) }));

/** The rules that load an installed file in place. */
type ReadOxlintAssetsInput = { readonly entries: ReadonlyArray<AssetEntry> };

/** An installed oxlint file, by its path relative to the workspace. */
type ReadOxlintAssetInput = { readonly path: string };

/** Each installed oxlint file a rule loads, once, with the value it gives each rule. */
export const readOxlintAssets = Effect.fn('readOxlintAssets')(function* ({
  entries,
}: ReadOxlintAssetsInput): Effect.fn.Return<ReadonlyArray<InstalledOxlintFile>, GenerateFailed> {
  const isExtended: (entry: AssetEntry) => boolean = ({ rule }) => rule.tool === RuleTool.Oxlint;
  const paths = entries.filter(isExtended).map(({ path }) => path);
  const extended = Array.dedupe(paths);

  return yield* Effect.forEach(extended, (path) => readOxlintAsset({ path }), { concurrency: 1 });
});

/** One installed oxlint file's rules. */
const readOxlintAsset = Effect.fn('readOxlintAsset')(function* ({
  path,
}: ReadOxlintAssetInput): Effect.fn.Return<InstalledOxlintFile, GenerateFailed> {
  const text = yield* readInput({ path });

  /** A file that does not decode, at its path. */
  const unreadableFile: (error: Schema.SchemaError) => GenerateFailed = (error) =>
    new GenerateFailed({ step: GenerateStep.Read, path, reason: error.message });

  const { rules } = yield* Schema.decodeUnknownEffect(OxlintFileJson)(text).pipe(Effect.mapError(unreadableFile));

  return { path, rules };
});
