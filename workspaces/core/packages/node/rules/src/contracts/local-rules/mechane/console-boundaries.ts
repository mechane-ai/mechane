import { ADOPTED, CRUISER_DEFAULTS, FileRole, OXLINT_DEFAULTS, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { escapedPath } from '../../../cruiser/escaped-path.ts';
import { FILE_ROLES } from '../../../file-roles.ts';

const BUILD_FILES = `^(?:${FILE_ROLES[FileRole.BrowserBuildConfiguration].map((path) => escapedPath({ path })).join('|')})$`;

/** Native SDK records use optional properties; Effect modules retain their Option convention. */
export const consoleBoundaries = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'console-build-owner',
      comment:
        'Import Console build helpers only from its build configuration, such as `worker-licenses.ts` in `vite.config.ts`',
      from: { pathNot: BUILD_FILES },
      to: { path: BUILD_FILES },
      standard: '113',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'console-api-owner',
      comment: 'Import the Console data owner for browser requests, such as `@mechane/console-data`',
      from: { path: '^packages/browser/', pathNot: '^packages/browser/console-data/' },
      to: { path: '^packages/shared/client/' },
      standard: '113',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'console-query-owner',
      comment: 'Keep Query observers in the data runtime; screens use canonical reads, such as `useSessions`',
      from: { path: '^packages/browser/', pathNot: '^packages/browser/console-data/src/console-data[.]ts$' },
      to: { path: 'node_modules/@tanstack/(?:query-core|react-query)/' },
      standard: '113',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'unicorn/require-post-message-target-origin',
      value: Severity.Error,
      maxSuppressions: 1,
      standard: '113',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'oxc/no-optional-chaining',
      value: Severity.Error,
      exemptRoles: [FileRole.Browser, FileRole.NativeRuntime, FileRole.NativePresentation],
      standard: '113',
    },
  ],
} as const satisfies ContractEnforcement;
