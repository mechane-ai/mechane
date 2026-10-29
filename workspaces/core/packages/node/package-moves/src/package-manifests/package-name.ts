import { Option } from 'effect';

/** A package's name at the start of a specifier: a scope and a name, or a name alone, before any subpath. */
const PACKAGE_NAME = /^(?:@[^/]+\/)?[^/]+/;

/** What a runtime's built-in module carries after its scheme, as `node:path` and `cloudflare:workers`. */
const SCHEME_END = ':';

type PackageNameInput = { readonly specifier: string };

/** The installed package a specifier names; none for a relative path or a runtime's built-in module. */
export function packageName({ specifier }: PackageNameInput): Option.Option<string> {
  if (specifier.startsWith('.') || specifier.includes(SCHEME_END)) {
    return Option.none();
  }

  return Option.map(Option.fromNullishOr(PACKAGE_NAME.exec(specifier)), ([name]) => name);
}
