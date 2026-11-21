/** The same package-source destinations apply to every hosted machine provider. */
const PACKAGE_SOURCE_HOSTS = [
  'github.com',
  '*.githubusercontent.com',
  'api.github.com',
  'registry.npmjs.org',
  'pypi.org',
  'files.pythonhosted.org',
] as const;

type IsPackageHostInput = { readonly hostname: string };

/** Wildcards match subdomains, never the bare suffix or a suffix followed by another domain. */
export function isPackageHost({ hostname }: IsPackageHostInput): boolean {
  const matches: (pattern: string) => boolean = (pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);

      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }

    return hostname === pattern;
  };

  return PACKAGE_SOURCE_HOSTS.some(matches);
}
