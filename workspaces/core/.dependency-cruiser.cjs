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
      from: { pathNot: 'routeTree[.]gen[.]ts$' },
      to: { circular: true, pathNot: 'routeTree[.]gen[.]ts$' },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Import a file that exists or a declared package, such as `./store.ts` or `effect`',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^cloudflare:' },
    },
    {
      name: 'postgres-store-owner',
      comment: 'Keep PostgreSQL clients in the store owner, such as `runtime/src/store/database.ts`',
      severity: 'error',
      from: { path: '^packages/', pathNot: '^packages/worker/control-store/src/store/' },
      to: { path: 'node_modules/pg/' },
    },
    {
      name: 'postgres-context-private',
      comment: 'Keep transaction clients private to the store, such as `runInTransaction` for its callers',
      severity: 'error',
      from: { path: '^packages/', pathNot: '^packages/worker/control-store/src/store/' },
      to: { path: '^packages/worker/control-store/src/store/context[.]ts$' },
    },
    {
      name: 'tests-outside-production',
      comment:
        'Import the smoke and its testing support only from each other, such as `packages/node/testing/src/cli/run-cli.ts` from `packages/node/smoke/src`',
      severity: 'error',
      from: { pathNot: '^(packages/node/smoke/src|packages/node/testing/src|packages/node/distribution/testing)/' },
      to: { path: '^(packages/node/smoke/src|packages/node/testing/src|packages/node/distribution/testing)/' },
    },
    {
      name: 'ui-foundations-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:foundations)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:foundations)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-foundations-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:foundations)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:foundations)/)' },
    },
    {
      name: 'ui-core-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:core)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:core)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-core-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:core)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:core|foundations)/)' },
    },
    {
      name: 'ui-overlays-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:overlays)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:overlays)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-overlays-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:overlays)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:overlays|foundations)/)' },
    },
    {
      name: 'ui-forms-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:forms)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:forms)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-forms-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:forms)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:forms|foundations|core|overlays)/)' },
    },
    {
      name: 'ui-feedback-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:feedback)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:feedback)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-feedback-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:feedback)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:feedback|foundations|core)/)' },
    },
    {
      name: 'ui-navigation-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:navigation)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:navigation)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-navigation-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:navigation)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:navigation|foundations|forms|overlays)/)' },
    },
    {
      name: 'ui-layout-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:layout)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:layout)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-layout-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:layout)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:layout|foundations|core|overlays)/)' },
    },
    {
      name: 'ui-collections-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:collections)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:collections)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-collections-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:collections)/', pathNot: '[.]stories[.]tsx$' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:collections|foundations|core|forms|overlays|feedback)/)',
      },
    },
    {
      name: 'ui-content-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:content)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:content)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-content-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:content)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:content|foundations|core|forms)/)' },
    },
    {
      name: 'ui-ai-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:ai)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:ai)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-ai-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:ai)/', pathNot: '[.]stories[.]tsx$' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:ai|foundations|core|forms|overlays|content|feedback)/)',
      },
    },
    {
      name: 'ui-charts-public-entry',
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:charts)/' },
      to: {
        path: '^(?:packages/browser/elements/packages)/(?!(?:charts)/)',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/visible-motion[.]ts|packages/browser/elements/packages/foundations/src/use-scroll-tab-index[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/control-styles[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-charts-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:charts)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:charts|foundations|core|forms|overlays|feedback)/)' },
    },
    {
      name: 'ui-dates-vendor-owner',
      comment:
        'Import the Elements dates API, such as `@mechane-ai/elements/forms/dates`, instead of its implementation dependency',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages)/',
        pathNot: '^(?:packages/browser/elements/packages)/(?:forms/src/dates)/',
      },
      to: { path: 'node_modules/(?:@daypicker/)' },
    },
    {
      name: 'ui-commands-vendor-owner',
      comment:
        'Import the Elements commands API, such as `@mechane-ai/elements/navigation/commands`, instead of its implementation dependency',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages)/',
        pathNot: '^(?:packages/browser/elements/packages)/(?:navigation/src/commands)/',
      },
      to: { path: 'node_modules/(?:@tanstack/react-hotkeys)' },
    },
    {
      name: 'ui-tables-vendor-owner',
      comment:
        'Import the Elements tables API, such as `@mechane-ai/elements/collections`, instead of its implementation dependency',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages)/',
        pathNot: '^(?:packages/browser/elements/packages)/(?:collections)/',
      },
      to: { path: 'node_modules/(?:@tanstack/(?:react-table|react-virtual))' },
    },
    {
      name: 'ui-content-vendor-owner',
      comment:
        'Import the Elements content API, such as `@mechane-ai/elements/content`, instead of its implementation dependency',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages)/',
        pathNot: '^(?:packages/browser/elements/packages)/(?:content)/',
      },
      to: { path: 'node_modules/(?:(?:@pierre/|streamdown|strip-ansi))' },
    },
    {
      name: 'ui-conversation-vendor-owner',
      comment:
        'Import the Elements conversation API, such as `@mechane-ai/elements/ai`, instead of its implementation dependency',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages)/',
        pathNot: '^(?:packages/browser/elements/packages)/(?:ai)/',
      },
      to: { path: 'node_modules/(?:@shadcn/)' },
    },
    {
      name: 'ui-charts-vendor-owner',
      comment:
        'Import the Elements charts API, such as `@mechane-ai/elements/charts`, instead of its implementation dependency',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages)/',
        pathNot: '^(?:packages/browser/elements/packages)/(?:charts)/',
      },
      to: { path: 'node_modules/(?:@visx/)' },
    },
    {
      name: 'ui-panes-vendor-owner',
      comment:
        'Import the Elements panes API, such as `@mechane-ai/elements/layout`, instead of its implementation dependency',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages)/',
        pathNot: '^(?:packages/browser/elements/packages)/(?:layout)/',
      },
      to: { path: 'node_modules/(?:react-resizable-panels)' },
    },
    {
      name: 'no-browser-catalog-imports',
      comment: 'Keep catalog examples in development, such as `import { Button } from "@mechane-ai/elements"`',
      severity: 'error',
      from: {
        path: '^packages/browser/',
        pathNot: '^packages/browser/(?:catalog/|.*[.]stories[.]tsx$|[^/]+/[.]storybook/|[^/]+/vite[.]config[.]ts$)',
      },
      to: { path: '^packages/browser/(?:catalog/|.*[.]stories[.]tsx$|[^/]+/[.]storybook/|[^/]+/vite[.]config[.]ts$)' },
    },
    {
      name: 'layer:@mechane/catalog',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/browser/catalog/src)/' },
      to: {
        path: '^(?:packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/console',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts)/',
      },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/browser/catalog/src/index[.]ts|packages/browser/catalog/src/preview[.]ts|packages/browser/console-data/src/index[.]ts|packages/browser/console-views/src/index[.]ts|packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/console-cache',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/browser/console-cache/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/console-data',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/browser/console-data/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/browser/console-cache/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/console-views',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/browser/console-views/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/csp/index[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]ts|packages/browser/elements/packages/foundations/src/constants[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane-ai/elements',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/browser/catalog/src/index[.]ts|packages/browser/catalog/src/preview[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/boundaries',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/boundaries/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/browser',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/browser/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/checks',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/checks/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/boundaries/src/index[.]ts|packages/node/checks-kernel/src/index[.]ts|packages/node/locks/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/normalizers/src/index[.]ts|packages/node/owned-rules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/node/wrangler/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/checks-kernel',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/checks-kernel/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli/src|packages/node/cli/scripts)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/cli-login/src/index[.]ts|packages/node/cli-update/src/index[.]ts|packages/node/commands/src/index[.]ts|packages/node/eval/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli-kernel',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli-kernel/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/commands/src/index[.]ts|packages/node/eval/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli-login',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli-login/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/commands/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/cli-update',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/cli-update/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/commands/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/commands',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/commands/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/distribution',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/distribution/src|packages/node/distribution/testing)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/stack/src/index[.]ts|packages/node/wrangler/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/eval',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/eval/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/guest',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/guest/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/browser/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/locks',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/locks/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/modules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/modules/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/normalizers',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/normalizers/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/owned-rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/owned-rules/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/program',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/program/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/release',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/release/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rename',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rename/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rule-generator',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rule-generator/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rule-shapes',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rule-shapes/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rules',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/rules/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/smoke',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/smoke/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/stack/src/index[.]ts|packages/node/testing/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/stack',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/stack/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/wrangler/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/testing',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/testing/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/stack/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/wrangler',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/wrangler/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane-ai/bash',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/bash/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/client',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/client/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/deployment',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/deployment/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
      },
    },
    {
      name: 'layer:@mechane/protocol',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/protocol/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/records',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/records/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
      },
    },
    {
      name: 'layer:@mechane/sandbox-wire',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/sandbox-wire/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
      },
    },
    {
      name: 'layer:@mechane/control-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/control-store/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/runtime',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/runtime/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/bash/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/control-store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/sandbox',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/sandbox/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/sandbox-store/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/sandbox-store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/sandbox-store/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/server/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/server',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/server/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/client/src/presentation/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/control-store/src/index[.]ts|packages/worker/runtime/src/index[.]ts|packages/worker/sandbox/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/store',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/store/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/browser/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/distribution/testing|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/protocol/src/presentation/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'lane:shared',
      comment:
        "Import Node's modules only outside the shared lane and the Workers runtime's only in the worker lane, such as `node:path` in `@mechane/cli` and `cloudflare:workers` in `@mechane/mech`",
      severity: 'error',
      from: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts|packages/browser/console-cache/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/shared/bash/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src)/',
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
          '^(?:packages/worker/control-store/src|packages/worker/runtime/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/server/src|packages/worker/store/src)/',
      },
      to: { path: '^cloudflare:' },
    },
    {
      name: 'confine:@ai-sdk/mcp',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/runtime/src)/' },
      to: { path: '/node_modules/@ai-sdk/mcp/' },
    },
    {
      name: 'confine:@base-ui/react',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@base-ui/react/' },
    },
    {
      name: 'confine:@daypicker/react',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@daypicker/react/' },
    },
    {
      name: 'confine:@earendil-works/chord',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/runtime/src)/' },
      to: { path: '/node_modules/@earendil-works/chord/' },
    },
    {
      name: 'confine:@earendil-works/pi-ai',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/runtime/src)/' },
      to: { path: '/node_modules/@earendil-works/pi-ai/' },
    },
    {
      name: 'confine:@earendil-works/pi-durable',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/shared/bash/src|packages/worker/runtime/src)/' },
      to: { path: '/node_modules/@earendil-works/pi-durable/' },
    },
    {
      name: 'confine:@journeyapps/wa-sqlite',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/browser/console-cache/src)/' },
      to: { path: '/node_modules/@journeyapps/wa-sqlite/' },
    },
    {
      name: 'confine:@pierre/diffs',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@pierre/diffs/' },
    },
    {
      name: 'confine:@pierre/highlights',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@pierre/highlights/' },
    },
    {
      name: 'confine:@pierre/theme',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@pierre/theme/' },
    },
    {
      name: 'confine:@pierre/trees',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@pierre/trees/' },
    },
    {
      name: 'confine:@shadcn/react',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@shadcn/react/' },
    },
    {
      name: 'confine:@tanstack/browser-db-sqlite-persistence',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/browser/console-cache/src)/' },
      to: { path: '/node_modules/@tanstack/browser-db-sqlite-persistence/' },
    },
    {
      name: 'confine:@tanstack/db',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/browser/console-data/src)/' },
      to: { path: '/node_modules/@tanstack/db/' },
    },
    {
      name: 'confine:@tanstack/db-sqlite-persistence-core',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/browser/console-data/src)/' },
      to: { path: '/node_modules/@tanstack/db-sqlite-persistence-core/' },
    },
    {
      name: 'confine:@tanstack/query-core',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/browser/console-data/src)/' },
      to: { path: '/node_modules/@tanstack/query-core/' },
    },
    {
      name: 'confine:@tanstack/react-db',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts)/',
      },
      to: { path: '/node_modules/@tanstack/react-db/' },
    },
    {
      name: 'confine:@tanstack/react-hotkeys',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@tanstack/react-hotkeys/' },
    },
    {
      name: 'confine:@tanstack/react-table',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@tanstack/react-table/' },
    },
    {
      name: 'confine:@tanstack/react-virtual',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@tanstack/react-virtual/' },
    },
    {
      name: 'confine:@visx/hierarchy',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@visx/hierarchy/' },
    },
    {
      name: 'confine:@visx/scale',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@visx/scale/' },
    },
    {
      name: 'confine:@visx/shape',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/@visx/shape/' },
    },
    {
      name: 'confine:cookie',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/node/testing/src)/' },
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
      name: 'confine:pg',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: { pathNot: '^(?:packages/worker/control-store/src)/' },
      to: { path: '/node_modules/pg/' },
    },
    {
      name: 'confine:react-resizable-panels',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/react-resizable-panels/' },
    },
    {
      name: 'confine:sonner',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/sonner/' },
    },
    {
      name: 'confine:streamdown',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/streamdown/' },
    },
    {
      name: 'confine:strip-ansi',
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      severity: 'error',
      from: {
        pathNot:
          '^(?:packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts)/',
      },
      to: { path: '/node_modules/strip-ansi/' },
    },
    {
      name: 'console-build-owner',
      comment:
        'Import Console build helpers only from its build configuration, such as `worker-licenses.ts` in `vite.config.ts`',
      severity: 'error',
      from: {
        pathNot: '^(?:packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts)$',
      },
      to: { path: '^(?:packages/browser/console/vite[.]config[.]ts|packages/browser/console/worker-licenses[.]ts)$' },
    },
    {
      name: 'console-api-owner',
      comment: 'Import the Console data owner for browser requests, such as `@mechane/console-data`',
      severity: 'error',
      from: { path: '^packages/browser/', pathNot: '^packages/browser/console-data/' },
      to: { path: '^packages/shared/client/' },
    },
    {
      name: 'console-query-owner',
      comment:
        'Keep Query observers and read-only diagnostics in the data owner; screens use admitted reads, such as `useMech`',
      severity: 'error',
      from: {
        path: '^packages/browser/',
        pathNot: '^packages/browser/console-data/src/(?:console-data|conversation|read-diagnostics)[.]ts$',
      },
      to: { path: 'node_modules/@tanstack/(?:query-core|react-query)/' },
    },
    {
      name: 'console-cache-persistence-owner',
      comment:
        'Keep native persistence composition in the cache lifecycle, such as `console-cache/src/store/storage.ts`',
      severity: 'error',
      from: { path: '^packages/', pathNot: '^packages/browser/console-cache/src/store/storage[.]ts$' },
      to: { path: 'node_modules/@tanstack/browser-db-sqlite-persistence/' },
    },
    {
      name: 'console-cache-native-worker',
      comment:
        'Use the native persistence API, such as `openBrowserWASQLiteOPFSDatabase`, instead of the raw wa-sqlite driver',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: 'node_modules/@journeyapps/wa-sqlite/' },
    },
    {
      name: 'single-durable-agent-owner',
      comment: 'Use Pi for agent execution, such as `Harness` in the Worker runtime',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: 'node_modules/(?:workflow|@workflow/[^/]+|@ai-sdk/workflow)/' },
    },
    {
      name: 'shared-bash-native-surface',
      comment:
        'Import native Bash tools and environment APIs in the shared binding, such as `createBashTool`; applications own Harness',
      severity: 'error',
      from: { path: '^packages/shared/bash/' },
      to: {
        path: 'node_modules/@earendil-works/pi-durable/',
        pathNot: 'node_modules/@earendil-works/pi-durable/dist/(?:env|tools)/',
      },
    },
    {
      name: 'durable-harness-owner',
      comment: 'Construct Pi in its Worker owner, such as `Harness` in packages/worker/runtime',
      severity: 'error',
      from: { path: '^packages/', pathNot: '^packages/(?:worker/runtime|shared/bash|node/smoke|node/testing)/' },
      to: { path: 'node_modules/@earendil-works/pi-durable/' },
    },
    {
      name: 'notification-integration-boundary',
      comment: 'Move platform adapters into the external notification producer, such as `createSlackAdapter` in Nexus',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: 'node_modules/(?:chat|@chat-adapter/[^/]+)/' },
    },
    {
      name: 'structured-renderer-owner',
      comment: 'Render catalog specifications through the product registry, such as `console-views/src/structured`',
      severity: 'error',
      from: {
        path: '^packages/',
        pathNot: '^packages/browser/console-views/src/(?:structured/|structured-message[.]tsx$)',
      },
      to: { path: 'node_modules/@json-render/react/' },
    },
    {
      name: 'sandbox-inspection-owner',
      comment:
        'Read stored observations in inspection, such as `store.latestStartup()`; prepare computers through the machine owner (131)',
      severity: 'error',
      from: { path: '^packages/worker/sandbox/src/inspection/' },
      to: {
        path: '^packages/worker/sandbox/src/',
        pathNot: '^packages/worker/sandbox/src/(?:inspection/|checkpoints/checkpoint-inactive-environment[.]ts$)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Only built bundles leave the graph; npm packages stay in it as leaves, so the rules on npm imports apply.
    exclude: { path: '^(?:packages/[^/]+/[^/]+/dist/|packages/worker/server/[.](?:output|swc)/)' },
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
