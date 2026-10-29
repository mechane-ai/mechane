import { Option, Redacted } from 'effect';

/** Git's fixed environment keys, kept here where the sanitized child environment is constructed. */
const GIT_VARIABLES = {
  path: 'PATH',
  home: 'HOME',
  locale: 'LANG',
  prompt: 'GIT_TERMINAL_PROMPT',
  noSystemConfiguration: 'GIT_CONFIG_NOSYSTEM',
  systemConfiguration: 'GIT_CONFIG_SYSTEM',
  globalConfiguration: 'GIT_CONFIG_GLOBAL',
  noSystemAttributes: 'GIT_ATTR_NOSYSTEM',
  skipLargeFileSmudge: 'GIT_LFS_SKIP_SMUDGE',
  configurationCount: 'GIT_CONFIG_COUNT',
  configurationKey: 'GIT_CONFIG_KEY_0',
  configurationValue: 'GIT_CONFIG_VALUE_0',
} as const;

type SourceGitEnvironmentInput = {
  readonly folder: string;
  /** None except for the credential-bearing fetch. */
  readonly token: Option.Option<Redacted.Redacted>;
};

type SourceAuthorizationInput = { readonly token: Redacted.Redacted };

/** Supplies only trusted executable paths and disables every ambient Git credential or configuration source. */
export function sourceGitEnvironment({ folder, token }: SourceGitEnvironmentInput): Readonly<Record<string, string>> {
  const environment = {
    [GIT_VARIABLES.path]: '/usr/bin:/bin',
    [GIT_VARIABLES.home]: folder,
    [GIT_VARIABLES.locale]: 'C.UTF-8',
    [GIT_VARIABLES.prompt]: '0',
    [GIT_VARIABLES.noSystemConfiguration]: '1',
    [GIT_VARIABLES.systemConfiguration]: '/dev/null',
    [GIT_VARIABLES.globalConfiguration]: '/dev/null',
    [GIT_VARIABLES.noSystemAttributes]: '1',
    [GIT_VARIABLES.skipLargeFileSmudge]: '1',
  };

  if (Option.isNone(token)) {
    return environment;
  }

  const authorization = sourceAuthorization({ token: token.value });

  return {
    ...environment,
    [GIT_VARIABLES.configurationCount]: '1',
    [GIT_VARIABLES.configurationKey]: 'http.extraHeader',
    [GIT_VARIABLES.configurationValue]: authorization,
  };
}

/** The short-lived token enters Git only through its per-process authorization header. */
function sourceAuthorization({ token }: SourceAuthorizationInput): string {
  const credential = Redacted.value(token);
  const authorization = Buffer.from(`x-access-token:${credential}`, 'utf8').toString('base64');

  return `Authorization: Basic ${authorization}`;
}
