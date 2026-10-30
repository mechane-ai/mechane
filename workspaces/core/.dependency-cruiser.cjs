/** Module boundaries that dependency-cruiser resolves import by import; the owned checks add entry points and packages. */
module.exports = {
  forbidden: [
    {
      name: 'no-non-package-json',
      comment:
        'Declare the package in the importing package\'s manifest before importing it, such as `"effect": "catalog:"`',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-circular',
      comment:
        'Break the cycle by moving what both files share into a file of its own, such as `session/types.ts`; type-only and dynamic imports count as edges',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Import a file that exists or a declared package, such as `./store.ts` or `effect`',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^cloudflare:' },
    },
    {
      name: 'role-order-constants',
      comment:
        'Move what the constants file needs from a later role file beside it, such as `type Phase` in `constants.ts`',
      severity: 'error',
      from: { path: '^(.+/)(?:|[^/]+[.])(?:constants)[.]ts$' },
      to: { path: '^$1(?:|[^/]+[.])(?:schemas|errors|types)[.]ts$' },
    },
    {
      name: 'role-order-schemas',
      comment:
        'Move what the schemas file needs from an errors or types file beside it, such as `type Kind` in `schemas.ts`',
      severity: 'error',
      from: { path: '^(.+/)(?:|[^/]+[.])(?:schemas)[.]ts$' },
      to: { path: '^$1(?:|[^/]+[.])(?:errors|types)[.]ts$' },
    },
    {
      name: 'role-order-errors',
      comment: 'Move what the errors file needs from a types file beside it, such as `type Step` in `errors.ts`',
      severity: 'error',
      from: { path: '^(.+/)(?:|[^/]+[.])(?:errors)[.]ts$' },
      to: { path: '^$1(?:|[^/]+[.])(?:types)[.]ts$' },
    },
    {
      name: 'role-order-behavior',
      comment: 'Move what the role file needs from a behavior file of its folder into a role file, such as `types.ts`',
      severity: 'error',
      from: { path: '^(.+/)(?:|[^/]+[.])(?:constants|schemas|errors|types)[.]ts$' },
      to: {
        path: '^$1[^/]+[.]ts$',
        pathNot:
          '^$1(?:|[^/]+[.])(?:constants|schemas|errors|types)[.]ts$|^packages/node/rule-shapes/src/contract-names[.]ts$',
      },
    },
    {
      name: 'tests-outside-production',
      comment:
        'Import the smoke and its testing support only from each other, such as `packages/node/testing/src/cli/run-cli.ts` from `packages/node/smoke/src`',
      severity: 'error',
      from: { pathNot: '^(packages/node/smoke/src|packages/node/testing/src)/' },
      to: { path: '^(packages/node/smoke/src|packages/node/testing/src)/' },
    },
    {
      name: 'layer:@mechane/boundaries',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/boundaries/src)/' },
      to: {
        path: '^(?:packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/checks',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/checks/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/boundaries/src/index[.]ts|packages/node/checks-kernel/src/index[.]ts|packages/node/locks/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/normalizers/src/index[.]ts|packages/node/owned-rules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/checks-kernel',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/checks-kernel/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli/src|packages/node/cli/scripts)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/cli-login/src/index[.]ts|packages/node/cli-update/src/index[.]ts|packages/node/commands/src/index[.]ts|packages/node/eval/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli-kernel',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli-kernel/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/commands/src/index[.]ts|packages/node/eval/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli-login',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli-login/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/commands/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli-update',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli-update/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/commands/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/commands',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/commands/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/distribution',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/distribution/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/wrangler/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/eval',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/eval/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/guest',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/guest/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/local-rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/local-rules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/rule-shapes/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/locks',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/locks/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/modules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/modules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/name-rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/name-rules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/rule-shapes/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/normalizers',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/normalizers/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/owned-rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/owned-rules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/package-moves',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/package-moves/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/normalizers/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/program',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/program/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/program-rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/program-rules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/rule-shapes/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/release',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/release/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rename',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rename/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rule-generator',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rule-generator/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rule-shapes',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rule-shapes/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/local-rules/src/index[.]ts|packages/node/name-rules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/program-rules/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/structure-rules/src/index[.]ts|packages/node/typescript-rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/smoke',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/smoke/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/stack/src/index[.]ts|packages/node/testing/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/stack',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/stack/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/wrangler/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/structure-rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/structure-rules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/rule-shapes/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/testing',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/testing/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/stack/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/typescript-rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/typescript-rules/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/rule-shapes/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/wrangler',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/wrangler/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/client',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/client/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/credentials',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/credentials/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/deployment',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/deployment/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot: '^(?:packages/shared/records/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/protocol',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/protocol/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/records',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/records/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
      },
    },
    {
      name: 'layer:@mechane/sandbox-wire',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/sandbox-wire/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/utilities',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/utilities/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
      },
    },
    {
      name: 'layer:@mechane/app',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/app/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/bindings/src/index[.]ts|packages/worker/directory/src/index[.]ts|packages/worker/edge/src/index[.]ts|packages/worker/key-cache/src/index[.]ts|packages/worker/limiter/src/index[.]ts|packages/worker/mech/src/index[.]ts|packages/worker/pages/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/sandbox/src/index[.]ts|packages/worker/workspace/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/bindings',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/bindings/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/directory',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/directory/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/directory-store/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/directory-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/directory-store/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/edge',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/edge/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/credentials/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/bindings/src/index[.]ts|packages/worker/integrations/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/harness',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/harness/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/harness-tools',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/harness-tools/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/integrations',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/integrations/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/key-cache',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/key-cache/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/key-cache-store/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/key-cache-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/key-cache-store/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/limiter',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/limiter/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/limiter-store/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/limiter-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/limiter-store/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/logs',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/logs/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/mech',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/mech/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/harness/src/index[.]ts|packages/worker/harness-tools/src/index[.]ts|packages/worker/integrations/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/mech-ports/src/index[.]ts|packages/worker/mech-store/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/mech-ports',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/mech-ports/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/harness/src/index[.]ts|packages/worker/harness-tools/src/index[.]ts|packages/worker/integrations/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/mech-store/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/mech-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/mech-store/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/pages',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/pages/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/credentials/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/bindings/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rpc',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/rpc/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/sandbox',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/sandbox/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/sandbox-store/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/sandbox-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/sandbox-store/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/store/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/workspace',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/workspace/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/store/src/index[.]ts|packages/worker/workspace-store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/workspace-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/workspace-store/src)/' },
      to: {
        path: '^(?:packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/local-rules/src|packages/node/locks/src|packages/node/modules/src|packages/node/name-rules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/package-moves/src|packages/node/program/src|packages/node/program-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/structure-rules/src|packages/node/testing/src|packages/node/typescript-rules/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'lane:shared',
      comment:
        "Import Node's modules only outside the shared lane and the Workers runtime's only in the worker lane, such as `node:path` in `@mechane/cli` and `cloudflare:workers` in `@mechane/mech`",
      severity: 'error',
      from: {
        path: '^(?:packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src)/',
      },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'lane:worker',
      comment:
        "Import Node's modules only outside the shared lane and the Workers runtime's only in the worker lane, such as `node:path` in `@mechane/cli` and `cloudflare:workers` in `@mechane/mech`",
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/key-cache-store/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
      },
      to: { path: '^cloudflare:' },
    },
    {
      name: 'confine:@earendil-works/chord',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/harness/src|packages/worker/harness-tools/src)/' },
      to: { path: '/node_modules/@earendil-works/chord/' },
    },
    {
      name: 'confine:@earendil-works/pi-ai',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/harness/src|packages/worker/harness-tools/src)/' },
      to: { path: '/node_modules/@earendil-works/pi-ai/' },
    },
    {
      name: 'confine:@earendil-works/pi-durable',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/harness/src|packages/worker/harness-tools/src)/' },
      to: { path: '/node_modules/@earendil-works/pi-durable/' },
    },
    {
      name: 'confine:@modelcontextprotocol/client',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/integrations/src)/' },
      to: { path: '/node_modules/@modelcontextprotocol/client/' },
    },
    {
      name: 'confine:cookie',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/node/testing/src|packages/worker/pages/src)/' },
      to: { path: '/node_modules/cookie/' },
    },
    {
      name: 'confine:dependency-cruiser',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/node/boundaries/src)/' },
      to: { path: '/node_modules/dependency-cruiser/' },
    },
    {
      name: 'confine:jose',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/integrations/src)/' },
      to: { path: '/node_modules/jose/' },
    },
    {
      name: 'confine:oxc-parser',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/node/checks-kernel/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src)/',
      },
      to: { path: '/node_modules/oxc-parser/' },
    },
    {
      name: 'confine:typebox',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/harness/src|packages/worker/harness-tools/src)/' },
      to: { path: '/node_modules/typebox/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Only built bundles leave the graph; npm packages stay in it as leaves, so the rules on npm imports apply.
    exclude: { path: '^packages/[^/]+/[^/]+/dist/' },
    // TypeScript 7 publishes no compiler API yet, so swc parses the sources; it keeps type-only imports as edges.
    parser: 'swc',
    combinedDependencies: true,
    preserveSymlinks: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
