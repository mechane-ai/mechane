# Product contracts

These rules govern `workspaces/core` after the [repository contracts](../../../.contracts/index.md). Contracts 001 to
064 are adopted from tenet-contracts v11.0.0, with 016, 020 and 064 updated to v11.1.0. UI contracts 065–078 adopt
v13.0.1. Each one's `paths` narrow it and its `## Local adaptations` state this product's choices.
The rule registry, [`@mechane/rules`](../packages/node/rules/src/index.ts), holds each value a tool
enforces once and generates every tool's configuration and the block that ends each contract's adaptations. Contracts
from 101 are Mechane's own.

## Boundaries

- [Console boundaries](113-console-boundaries/CONTRACT.md): browser package ownership, session data, and release assets.
- [Console cache lifecycle](119-console-cache-lifecycle/CONTRACT.md): admitted shared copies, native replication, and scoped lifecycle and write locks.

- [Ownership and boundaries](001-code-ownership-and-boundaries/CONTRACT.md): one owner per decision and fact.
- [Dependency boundaries](002-code-dependency-boundaries/CONTRACT.md): every member declared once, and each edge once in its `package.json`.
- [Package boundaries](003-code-typescript-package-boundaries/CONTRACT.md): exports maps and workspace links only.
- [Module boundaries](004-code-typescript-module-boundaries/CONTRACT.md): entry points and an acyclic file graph.
- [Entry points](005-code-typescript-entry-points/CONTRACT.md): an `index.ts` holds named re-exports only.
- [Export consumers](006-code-export-consumers/CONTRACT.md): real consumers and a deliberate supported npm UI boundary.

## Structure

- [Module structure](007-code-module-structure-and-control-flow/CONTRACT.md): focused modules named for their behavior.
- [File roles](008-code-module-file-roles/CONTRACT.md): cohesive concept modules and explicit public exports.
- [Folder size](009-code-folder-size/CONTRACT.md): folders organized by behavior and ownership.
- [Function size](010-code-function-size/CONTRACT.md): readable decisions, effects, and recovery without extraction quotas.
- [Guard clauses](011-code-guard-clauses/CONTRACT.md): leave early; no `else` after a branch that leaves.
- [Conditional expressions](012-code-conditional-expressions/CONTRACT.md): no conditional operator, an IIFE only as SC-01 allows, and at most `logicalOperators` logical operators.
- [Exhaustive branches](013-code-exhaustive-branches/CONTRACT.md): an `else if` equality chain becomes a `switch` that names every member of a closed set.
- [Closed value sets](014-code-closed-value-sets/CONTRACT.md): declare a set once, HTTP methods and status codes included, and compare by member.

## TypeScript

- [Const bindings](015-code-typescript-const-bindings/CONTRACT.md): `const`, and `let` only in a loop.
- [Input immutability](016-code-typescript-input-immutability/CONTRACT.md): never change a parameter.
- [Type assertions](017-code-typescript-type-assertions/CONTRACT.md): narrow and decode instead of asserting.
- [Named types](018-code-typescript-named-types/CONTRACT.md): no inline object types.
- [Function arguments](019-code-typescript-function-arguments/CONTRACT.md): one destructured object argument.
- [Call arguments](064-code-typescript-call-arguments/CONTRACT.md): bind a nested call before passing it, and bind functions as declarations or typed consts.
- [Class declarations](020-code-typescript-class-declarations/CONTRACT.md): classes only for the runtime and tagged errors.
- [Module state](021-code-typescript-module-state/CONTRACT.md): no mutable module state.
- [Compiler strictness](022-code-typescript-compiler-strictness/CONTRACT.md): one strict base configuration.
- [File names](023-code-typescript-file-names/CONTRACT.md): kebab-case files named for their concept or operation.
- [Effect errors](024-code-typescript-effect-errors/CONTRACT.md): tagged errors; Effects run only at entry points.
- [Effect schemas](025-code-typescript-effect-schemas/CONTRACT.md): decode every boundary with Effect Schema.

## Names and comments

- [Blank lines](026-code-blank-lines/CONTRACT.md): control flow, returns, calls and multi-line statements stand apart from their neighbors.
- [Boolean names](027-code-boolean-names/CONTRACT.md): predicate and option prefixes.
- [Measured value names](028-code-measured-value-names/CONTRACT.md): units and counted nouns.
- [Numeric literals](063-code-numeric-literals/CONTRACT.md): every number but -1, 0 and 1 has a named constant, a span or byte size in its unit.
- [Spelled-out names](029-code-spelled-out-names/CONTRACT.md): no abbreviations, no one-letter names.
- [Domain vocabulary](030-code-domain-vocabulary/CONTRACT.md): one word per concept, from the glossary.
- [Comment content](031-code-comment-content/CONTRACT.md): reasons, constraints and invariants only.
- [Comment form](032-code-comment-form/CONTRACT.md): no task markers or commented-out code.
- [Comment attribution](033-code-comment-attribution/CONTRACT.md): comments explain behavior, not which rule asked.
- [Lint suppressions](034-code-lint-suppressions/CONTRACT.md): one site, one named rule, one reason; stale ones fail.

## Shared code and programs

- [Duplicated blocks](035-code-duplicated-blocks/CONTRACT.md): jscpd fails on any copied block of the declared size.
- [Shared definitions](036-code-shared-definitions/CONTRACT.md): a pattern of the declared length lives once.
- [Shared utilities](037-code-shared-utilities/CONTRACT.md): Effect first, then one utilities module per application.
- [Environment settings](038-code-environment-settings/CONTRACT.md): one settings module per program.
- [Script entry points](039-code-script-entry-points/CONTRACT.md): an executable's top level runs `main` and nothing else.
- [Diagnostic messages](040-code-diagnostic-messages/CONTRACT.md): one clause that names the operation and its input.
- [Execution lifecycle](041-code-execution-lifecycle/CONTRACT.md): owned deadlines, cleanup and retries.
- [Command reference](042-cli-command-reference-generation/CONTRACT.md): one command model drives the parser and the reference.
- [Output channels](043-cli-output-channels/CONTRACT.md): results on standard output, everything else on standard error.

## Data and tests

- [Record identifiers](044-data-record-identifiers/CONTRACT.md): random UUIDs; derived ids only where a retry needs them.
- [Store ownership](045-data-store-ownership/CONTRACT.md): one store module per owner of persisted data.
- [SQL store boundaries](046-data-sql-store-boundaries/CONTRACT.md): SQL only in the store, each statement once and whole.
- [Stored and shipped formats](047-data-stored-and-shipped-formats/CONTRACT.md): stored format changes and the explicit native-runtime cutover baseline.
- [Schema rollouts](061-data-sql-schema-rollouts/CONTRACT.md): steps the previous release and existing rows survive.
- [Data and APIs](048-data-and-apis/CONTRACT.md): explicit outcomes behind small APIs.
- [Request paths](062-api-typescript-request-paths/CONTRACT.md): one named builder per path, which encodes each part.
- [Scenario functions](049-test-scenario-functions/CONTRACT.md): one function per guarantee, named for it.
- [Test support modules](050-test-support-modules/CONTRACT.md): one helper a file in `packages/node/testing/src`, imported through its entry point.

## Security

- [API key lifecycle](051-security-api-key-lifecycle/CONTRACT.md): hashed keys that only a browser approval issues.
- [CLI credentials](052-security-cli-credential-lifecycle/CONTRACT.md): an owner-only saved login bound to its origin.
- [Browser sessions](053-security-oauth-browser-sessions/CONTRACT.md): the GitHub sign-in and its host-only cookies.
- [Secret storage](054-security-server-secret-storage/CONTRACT.md): one held secret, and no stored token in plain text.
- [Access control](055-security-resource-access-control/CONTRACT.md): each caller reads and changes only its own records.
- [Interpreter injection](056-security-interpreter-injection/CONTRACT.md): bound SQL values, escaped markup, argument lists.

## Evals

- [Eval run lifecycle](057-eval-run-lifecycle/CONTRACT.md): frozen plans, one writer, receipts before sends, resume.
- [Eval grading isolation](058-eval-grading-isolation/CONTRACT.md): expectations only for the grader, on another model.
- [Eval production path](059-eval-production-path/CONTRACT.md): the deployment through `/api/v1`, on fresh mechs.
- [Eval score accounting](060-eval-score-accounting/CONTRACT.md): distinct verdicts, and spend by role.

## UI

- [Presentation boundaries](065-ui-presentation-boundaries/CONTRACT.md): product-neutral controls, layout, and charts.
- [Design tokens](066-ui-design-tokens/CONTRACT.md): shared visual roles and exhaustive named variants.
- [Component APIs](067-ui-react-typescript-component-apis/CONTRACT.md): typed supported modes and Base UI composition.
- [Control accessibility](068-ui-control-accessibility/CONTRACT.md): semantic controls, keyboard use, and managed focus.
- [Interaction ownership](069-ui-react-interaction-ownership/CONTRACT.md): one state owner and cleanup for each interaction.
- [Presentation state](070-ui-presentation-state/CONTRACT.md): supplied records, controlled selection, and preserved drafts.
- [Async read states](071-ui-async-read-states/CONTRACT.md): pending, failed, ready, and stale content without false empties.
- [Display values](072-ui-deterministic-display-values/CONTRACT.md): explicit formatting and distinct missing values.
- [Motion lifecycle](073-ui-motion-lifecycle/CONTRACT.md): immediate interaction, interruptible motion, and cleanup.
- [Component guidance](074-ui-component-usage-guidance/CONTRACT.md): supported components and usage beside their source.
- [Storybook checks](075-ui-storybook-component-checks/CONTRACT.md): synthetic documentation and explicitly retained plays.
- [Data tables](076-ui-data-tables/CONTRACT.md): prepared rows, stable identity, and controlled sort and page intent.
- [Time series](077-ui-time-series-charts/CONTRACT.md): honest observations and equal pointer, touch, and keyboard inspection.
- [Keyboard shortcuts](078-ui-keyboard-shortcuts/CONTRACT.md): scoped commands with application-owned eligibility.
- [StyleX composition](114-ui-stylex-composition/CONTRACT.md): direct token imports and preserved composed control props.
- [Waterfall charts](115-ui-waterfall-charts/CONTRACT.md): interval, point, and unavailable geometry with textual evidence.
- [Content rendering](116-ui-content-rendering/CONTRACT.md): safe supplied text, exact source identity, and bounded inspection.
- [Conversation state](117-ui-conversation-state/CONTRACT.md): reader intent, draft preservation, and supplied agent activity.
- [Analytical graphics](118-ui-analytical-graphics/CONTRACT.md): explicit measurements, missing values, domains, and relationships.

## Mechane

- [Package layers](101-package-layers/CONTRACT.md): each package's layer, lane and consumers, from `dependencies.json`.
- [Rule registry](110-rule-registry/CONTRACT.md): every enforced value and rule declared once, and every configuration generated.
- [Code style](111-code-style/CONTRACT.md): cohesive modules, readable callbacks, and consistent paths, units and HTTP vocabulary.
- [Installation ownership](112-installation-ownership/CONTRACT.md): immutable releases, one infrastructure owner, and runtime data preserved across applies.

- [Execution access](120-execution-access/CONTRACT.md): current owner grants and transient shell credentials.
- [Thread continuations](121-thread-continuations/CONTRACT.md): native external-decision waits and original reply routing.
- [Developer environments](122-developer-environments/CONTRACT.md): reproducible tools, committed files, and honest recovery.
- [Model caching](123-model-caching/CONTRACT.md): provider cache hints, isolated sessions, and conservative spend reservations.

- [Native Workflow runtime](124-native-workflow-runtime/CONTRACT.md): one durable execution path, private credentials, and native UI streams.
- [Channel delivery](125-channel-delivery/CONTRACT.md): verified admission, native formatting, and stable delivery receipts.
- [Structured presentation](126-structured-presentation/CONTRACT.md): one bounded catalog with native Chat and Elements renderers.
