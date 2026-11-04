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
      name: 'tests-outside-production',
      comment:
        'Import the smoke and its testing support only from each other, such as `packages/node/testing/src/cli/run-cli.ts` from `packages/node/smoke/src`',
      severity: 'error',
      from: { pathNot: '^(packages/node/smoke/src|packages/node/testing/src)/' },
      to: { path: '^(packages/node/smoke/src|packages/node/testing/src)/' },
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-collections-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:collections)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:collections|foundations|core|forms|overlays)/)' },
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-ai-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:ai)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:ai|foundations|core|forms|overlays|content)/)' },
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
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/browser/elements/packages/foundations/src/accessibility[.]ts|packages/browser/elements/packages/foundations/src/control-state[.]ts|packages/browser/elements/packages/foundations/src/style-composition[.]ts|packages/browser/elements/packages/foundations/src/overlay-styles[.]ts|packages/browser/elements/packages/foundations/src/popup-styles[.]ts)$',
      },
    },
    {
      name: 'ui-charts-dependencies',
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      severity: 'error',
      from: { path: '^(?:packages/browser/elements/packages)/(?:charts)/', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^(?:packages/browser/elements/packages)/(?!(?:charts|foundations|core|forms|feedback)/)' },
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
        path: '^(?:packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/console',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: {
        path: '^(?:packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts)/',
      },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/browser/catalog/src/index[.]ts|packages/browser/catalog/src/preview[.]ts|packages/browser/console-data/src/index[.]ts|packages/browser/console-views/src/index[.]ts|packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/console-data',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/browser/console-data/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/console-views',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/browser/console-views/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/browser/elements/packages/core/src/index[.]ts|packages/browser/elements/packages/forms/src/index[.]ts|packages/browser/elements/packages/forms/src/dates/index[.]ts|packages/browser/elements/packages/overlays/src/index[.]ts|packages/browser/elements/packages/feedback/src/index[.]ts|packages/browser/elements/packages/navigation/src/index[.]ts|packages/browser/elements/packages/navigation/src/commands/index[.]ts|packages/browser/elements/packages/layout/src/index[.]ts|packages/browser/elements/packages/collections/src/index[.]ts|packages/browser/elements/packages/content/src/index[.]ts|packages/browser/elements/packages/content/src/link[.]ts|packages/browser/elements/packages/content/src/markdown/index[.]ts|packages/browser/elements/packages/content/src/code/index[.]ts|packages/browser/elements/packages/content/src/diff/index[.]ts|packages/browser/elements/packages/content/src/tree/index[.]ts|packages/browser/elements/packages/ai/src/index[.]ts|packages/browser/elements/packages/charts/src/index[.]ts|packages/browser/elements/packages/charts/src/cartesian/index[.]ts|packages/browser/elements/packages/charts/src/distribution/index[.]ts|packages/browser/elements/packages/charts/src/matrix/index[.]ts|packages/browser/elements/packages/charts/src/graph/index[.]ts|packages/browser/elements/packages/charts/src/hierarchy/index[.]ts|packages/browser/elements/packages/charts/src/timeline/index[.]ts|packages/browser/elements/packages/foundations/src/theme[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/tokens[.]stylex[.]ts|packages/browser/elements/packages/foundations/src/styles[.]css|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/browser/catalog/src/index[.]ts|packages/browser/catalog/src/preview[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/boundaries',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/boundaries/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/stack/src/index[.]ts|packages/node/wrangler/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/eval',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/eval/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/locks',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/locks/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/normalizers',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/normalizers/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/checks-kernel/src/index[.]ts|packages/node/modules/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/rules/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/program',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/program/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/release',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/release/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/rule-shapes/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/smoke',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/smoke/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/wrangler/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/testing',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/testing/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/node/cli-kernel/src/index[.]ts|packages/node/program/src/index[.]ts|packages/node/release/src/index[.]ts|packages/node/stack/src/index[.]ts|packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/wrangler',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/node/wrangler/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
      },
    },
    {
      name: 'layer:@mechane/sandbox-wire',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/shared/sandbox-wire/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
      },
    },
    {
      name: 'layer:@mechane/app',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/app/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/authentication/src/index[.]ts|packages/worker/bindings/src/index[.]ts|packages/worker/directory/src/index[.]ts|packages/worker/edge/src/index[.]ts|packages/worker/key-cache/src/index[.]ts|packages/worker/limiter/src/index[.]ts|packages/worker/mech/src/index[.]ts|packages/worker/pages/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/sandbox/src/index[.]ts|packages/worker/workspace/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/authentication',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/authentication/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/credentials/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/bindings/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/bindings',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/bindings/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/credentials/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/authentication/src/index[.]ts|packages/worker/bindings/src/index[.]ts|packages/worker/integrations/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/harness',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/harness/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts|packages/worker/store/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/limiter',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/limiter/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
        pathNot:
          '^(?:packages/shared/client/src/index[.]ts|packages/shared/credentials/src/index[.]ts|packages/shared/deployment/src/index[.]ts|packages/shared/protocol/src/index[.]ts|packages/shared/records/src/index[.]ts|packages/shared/sandbox-wire/src/index[.]ts|packages/shared/utilities/src/index[.]ts|packages/worker/authentication/src/index[.]ts|packages/worker/bindings/src/index[.]ts|packages/worker/logs/src/index[.]ts|packages/worker/rpc/src/index[.]ts)$',
      },
    },
    {
      name: 'layer:@mechane/rpc',
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      severity: 'error',
      from: { path: '^(?:packages/worker/rpc/src)/' },
      to: {
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace-store/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/node/boundaries/src|packages/node/checks/src|packages/node/checks-kernel/src|packages/node/cli/src|packages/node/cli/scripts|packages/node/cli-kernel/src|packages/node/cli-login/src|packages/node/cli-update/src|packages/node/commands/src|packages/node/distribution/src|packages/node/eval/src|packages/node/guest/src|packages/node/locks/src|packages/node/modules/src|packages/node/normalizers/src|packages/node/owned-rules/src|packages/node/program/src|packages/node/release/src|packages/node/rename/src|packages/node/rule-generator/src|packages/node/rule-shapes/src|packages/node/rules/src|packages/node/smoke/src|packages/node/stack/src|packages/node/testing/src|packages/node/wrangler/src|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src|packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src)/',
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
        path: '^(?:packages/browser/catalog/src|packages/browser/console/src|packages/browser/console/[.]storybook|packages/browser/console/vite[.]config[.]ts|packages/browser/console-data/src|packages/browser/console-views/src|packages/browser/elements/packages|packages/browser/elements/[.]storybook|packages/browser/elements/vite[.]config[.]ts|packages/shared/client/src|packages/shared/credentials/src|packages/shared/deployment/src|packages/shared/protocol/src|packages/shared/records/src|packages/shared/sandbox-wire/src|packages/shared/utilities/src)/',
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
          '^(?:packages/worker/app/src|packages/worker/authentication/src|packages/worker/bindings/src|packages/worker/directory/src|packages/worker/directory-store/src|packages/worker/edge/src|packages/worker/harness/src|packages/worker/harness-tools/src|packages/worker/integrations/src|packages/worker/key-cache/src|packages/worker/limiter/src|packages/worker/limiter-store/src|packages/worker/logs/src|packages/worker/mech/src|packages/worker/mech-ports/src|packages/worker/mech-store/src|packages/worker/pages/src|packages/worker/rpc/src|packages/worker/sandbox/src|packages/worker/sandbox-store/src|packages/worker/store/src|packages/worker/workspace/src|packages/worker/workspace-store/src)/',
      },
      to: { path: '^cloudflare:' },
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
      from: { pathNot: '^(?:packages/node/testing/src|packages/worker/authentication/src)/' },
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
