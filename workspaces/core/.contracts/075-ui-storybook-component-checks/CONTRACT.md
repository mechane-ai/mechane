---
name: ui-storybook-component-checks
paths: ["packages/browser/ui/**","packages/browser/ui-tokens/**","packages/browser/ui-layout/**","packages/browser/ui-charts/**","packages/browser/console-views/**","packages/browser/console/src/stories/**","packages/browser/console/.storybook/**","packages/browser/console/vite.config.ts"]
message: Give every public component synthetic stories of its meaningful states and assert only consequential owned interactions.
---

## Rules

Give every exported component at least one story, alone or in a representative composition.
Show each supported variant and meaningful state as a story, including populated, empty, loading, initial failure, refresh failure with retained data, disabled, and denied states where the component owns them.
Do not repeat a story per theme or viewport; add a narrow-viewport story only when the layout changes behavior at that size.
Document a primary component and its public subcomponents in one story file's metadata, so the generated documentation covers both.
Cover private parts through their public component, and do not add stories or exports for internal extractions.

Render stories from fixed synthetic data, without application providers, live services, production records, or credentials.
Build Storybook with the same compiler and styling configuration as the application.

Add a `play` function only for a primary owned interaction or a distinct consequential failure that existing coverage would miss.
Select the stories that run as tests with an explicit tag or list rather than a default every story receives, so adding a story adds no test until it is selected.
Assert outcomes through accessible roles, visible state, and callback payloads.
Do not assert style classes, incidental markup, or each intermediate step of an interaction.
Let composition-only wrappers rely on their children's coverage.
Reproduce timing-dependent states with story inputs or gated responses, and never assert exact timing.
Do not treat a passing story as proof of application wiring, authorization, or real requests.

## Checks

Compare exported components with story files and confirm each has a story.
Build the Storybook catalog without application services.
Run the interaction tests for changed `play` functions locally, and confirm the selected stories actually execute.
Add a story that no tag or list selects, and confirm the test run does not execute it.
Review each new `play` function against `test-curation`: does it guard a consequential, owned interaction?
Inspect changed stories in every supported theme, at a narrow viewport, and with the keyboard.

## Local adaptations

The existing Console Storybook runner discovers colocated component stories and representative screen stories.
Stories are maintained developer documentation with fixed synthetic inputs. Their fixtures are limited to the states
they explain; extra browser probes and their fixtures remain disposable development evidence.
Catalog-only dependencies stay development dependencies, and stories never enter production package exports.

The upstream clause "Add a `play` function only for a primary owned interaction or a distinct consequential failure
that existing coverage would miss." is replaced by the repository's stronger retention rule: every retained play
must guard a consequential regression missed by existing coverage and use an approved runner.
A primary interaction alone does not justify an assertion. Do not add play functions or automatic test tags as a
catalog default. A future retained play must be selected explicitly.

The repository keeps its one runtime smoke suite, no unit suite, and no mocks of Mechane product code.
Storybook's accessibility addon supports inspection without making every story a test.
The root test-curation and assertion-integrity contracts govern any retained interaction assertion.
The Storybook build proves catalog composition and compilation, not browser focus, authorization, or actual requests.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `no-browser-catalog-imports` (075): enforced: Keep catalog examples in development, such as `import { Button } from "@mechane/ui"`

<!-- End of the generated block. -->
