import { Effect, Schema } from 'effect';
import { parse as parseJsonc } from 'jsonc-parser';
import { extname } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import { InputUnreadable } from './errors.ts';
import { readText } from './read-text.ts';

/** The extensions of the configuration formats other than JSON and JSONC that the checks decode. */
const ConfigurationExtension = { Yaml: '.yaml', Yml: '.yml', Toml: '.toml' } as const;

type ConfigurationExtension = (typeof ConfigurationExtension)[keyof typeof ConfigurationExtension];

type DecodeFileInput<S> = { readonly path: string; readonly schema: S };

type ParseConfigurationInput = { readonly path: string; readonly text: string };

/** Reads a JSON, JSONC, YAML or TOML file, by its extension, and decodes it with `schema`. */
export const decodeFile = Effect.fn('decodeFile')(function* <S extends Schema.Codec<unknown, unknown>>({
  path,
  schema,
}: DecodeFileInput<S>): Effect.fn.Return<S['Type'], InputUnreadable> {
  const text = yield* readText({ path });

  const value = yield* Effect.try({
    try: () => parseConfiguration({ path, text }),
    catch: (cause) => new InputUnreadable({ path, reason: String(cause) }),
  });

  return yield* Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError((error) => new InputUnreadable({ path, reason: error.message })),
  );
});

/** A configuration's value, parsed by the format its extension names; JSON and JSONC are the default. */
function parseConfiguration({ path, text }: ParseConfigurationInput): unknown {
  switch (extname(path)) {
    case ConfigurationExtension.Yaml:
    case ConfigurationExtension.Yml:
      return parseYaml(text);
    case ConfigurationExtension.Toml:
      return parseToml(text);
    default:
      return parseJsonc(text);
  }
}
