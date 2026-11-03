# Mechane components

Use the component catalog to choose a maintained component and copy its recommended composition. Run
`pnpm --filter @mechane/console storybook` from `workspaces/core`. The same runner discovers package-local stories and
Console screen examples. Every example uses fixed synthetic data and works without application services.

**Supported** means a component has a Console consumer, maintained public behavior, and catalog guidance. It ships with
the application’s release. Proposed components are not callable APIs. The package entry points and colocated stories
describe the available components; there is no separate component registry.

## Choose

| Need                     | Owner and example                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Visual roles             | [Token foundations](../packages/browser/ui-tokens/src/tokens.stories.tsx)                      |
| An action or destination | [Button, IconButton, TextButton, and TextLink](../packages/browser/ui/src/actions.stories.tsx) |
| A labeled input          | [Field, Input, and Textarea](../packages/browser/ui/src/forms.stories.tsx)                     |
| A fixed choice           | [Select](../packages/browser/ui/src/select.stories.tsx)                                        |
| A focused decision       | [Dialog](../packages/browser/ui/src/dialog.stories.tsx)                                        |
| Supplemental help        | [Tooltip](../packages/browser/ui/src/tooltip.stories.tsx)                                      |
| A page frame             | [AppShell and its public parts](../packages/browser/ui-layout/src/app-shell.stories.tsx)       |
| Comparable records       | [Table and cursor actions](../packages/browser/ui/src/table.stories.tsx)                       |
| Recorded timing          | [Waterfall](../packages/browser/ui-charts/src/waterfall.stories.tsx)                           |

Each family’s metadata describes its root and public parts, their alternatives, and the decisions the application must
supply. Components accept presentation values; resource mapping, authorization, routing, and requests stay with their
application owners. Use a component’s named variant before adding placement styles.

Compound APIs such as Field and Dialog are documented through their family compositions and exported types. Inferred
Storybook prop tables are partial with the pinned compiler. Read the owning source types for inherited native and Base
UI props; the tables are not an exhaustive API reference.

Import shared tokens directly from `@mechane/ui-tokens/tokens.stylex`. StyleX needs the defining export to compile
variables. These are CSS values; chart scales need numeric geometry in the caller’s unit. Shell measurements belong to
`ui-layout`. The supported theme is light.

## Compose

Button performs an action; TextLink is an anchor. An icon-only action always needs its own accessible label, even when a
Tooltip is present. Button’s `variant` controls emphasis, `tone` describes intent, and `pending` prevents duplicate
activation. The application owns the asynchronous operation and its recovery.

Field associates its label, description, and error with the input. Native input events remain available. Choose a
controlled value with its change callback or an uncontrolled default value. A read-only value remains selectable; a
disabled control is unavailable. The [form example](../packages/browser/ui/src/forms.stories.tsx) shows native
validation and local draft state.

Multi-part controls retain Base UI names such as `Root`, `Trigger`, and `Popup`. Use `render` to compose triggers.
Shared styles apply first, then concrete native classes and style objects are merged for upstream composition. The typed
`xstyle` input permits placement adjustments without replacing focus, typography, or disabled styles.

State callbacks for `className` and `style` work on a directly rendered control or the outermost trigger. The pinned
Base UI release cannot preserve those callbacks on an inner React element supplied through `render`. Use concrete
classes and style objects on that element. For state-dependent composition, use a `render` function, spread its supplied
props, and choose named variants from its state. The [Dialog examples](../packages/browser/ui/src/dialog.stories.tsx)
show both patterns with a Tooltip. Base UI documents
[render functions](https://base-ui.com/react/handbook/composition#render-function) and their
[explicit prop merging](https://base-ui.com/react/utils/merge-props).

Keep a successful result mounted during refreshes. Show refresh progress or failure beside that result. Use Loading for
missing initial data and EmptyState for a successful empty result. The application decides when access loss or a
resource change requires clearing data.

## Review

Start with each family’s **Recommended** story. Other stories show supported variants and meaningful states. Narrow
examples cover layouts that change behavior, including tables, navigation, tabs, and Waterfall. Long labels and unknown
values stay part of those maintained examples.

Use Storybook’s accessibility panel, then inspect keyboard order, visible focus, labels, announcements, dismissal, and
focus return. The catalog does not import Console global styles, so components must own their appearance. Automated
accessibility results alone do not establish complete accessibility.

`pnpm --filter @mechane/console build-storybook` uses the application’s React and StyleX compiler settings. Stories are
developer documentation: the preview removes the inherited test tag, and no play assertion runs by default. Add a
retained interaction check only for a consequential gap under the repository’s test-curation rules. Browser acceptance
against the packaged Console remains necessary for application wiring and real requests.
