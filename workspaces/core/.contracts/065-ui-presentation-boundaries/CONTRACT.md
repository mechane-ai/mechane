---
name: ui-presentation-boundaries
paths: ["packages/browser/ui/**"]
message: Render supplied data and report intent; leave requests, routing, identity, and domain decisions to applications.
---

## Rules

Render presentation components from explicit input values and report user intent through callbacks.
Keep requests, caches, routing, authentication, authorization, persistence, validation policy, analytics, and domain decisions in the application.
Do not import application source, network or API clients, routers, data-fetching or cache libraries, credential stores, or generated transport types into presentation code, including through type-only or relative imports.
Accept presentation-shaped records; the application converts API responses, query results, and stored models before passing them in.
Let the application map domain concepts onto presentation choices, such as an order status onto a badge tone.
Receive internal navigation through an application-supplied link renderer or destination value, not through a router import.
Render the permission state the application supplies instead of deriving access decisions in presentation.
Pass independently loaded regions into a component as ready content through named slots, never as pending requests for the component to resolve.

Limit a shared component library to product-neutral visual and interaction primitives, such as controls, layout, typography, and tokens.
Keep product entities, status mappings, and business rules out of the shared component library.
Keep the shared component library independent of every application and feature presentation package that consumes it.

Keep a feature view's components, presentation types, display formatting, styles, and examples together in one folder or package.
Do not split one view between a presentation package and application-local components.

Give each third-party UI library one stated responsibility, and import it only inside the components that wrap it.
Declare dependencies used only by examples or the component catalog as development dependencies.

Keep every presentation component renderable in isolation from synthetic inputs, without application context, live services, network access, or credentials.

## Checks

Inspect changed presentation manifests and imports, including type-only and relative imports, for application, transport, routing, or data-access dependencies.
Render each changed component in isolation from synthetic inputs with no application context or services.
Trace one user action from its presentation callback to the application handler: does the application own the request and the domain decision?
Review new shared-library exports: does any export name a product concept, status mapping, or business rule?
Review changed presentation event handlers and lifecycle code for requests, persistence, or cache work, which an import check cannot see when it arrives through an injected function.

## Local adaptations

This contract governs one published package, `@mechane-ai/ui`. Its internal modules live under `ui/packages`, with
one manifest and version. `console-views` may use Mechane records and domain formatting under contract 113.
A resource view does not need a duplicate type for each shared API record.

The module graph permits these dependencies:

| Module | Other UI modules it may consume |
| --- | --- |
| `core` | None |
| `layout` | `core` |
| `collections` | `core` |
| `content` | `core`, `collections` |
| `ai` | `core`, `collections`, `content` |
| `charts` | `core` |

Import another module through a declared public entry point. Import tokens directly from their `.stylex` definition,
as contract 114 requires. The core entry imports none of the heavier families. Catalog stories may compose the public
entries together. Applications compose charts, layout, content, and AI without adding reverse dependencies.

Give each implementation library one job inside its owning module:

| Library | Owner and responsibility |
| --- | --- |
| Base UI | `core` preserves accessible control, focus, overlay, and composition behavior. |
| Lucide | Browser presentation uses one icon vocabulary and shared icon sizing. |
| StyleX | `core/src/tokens.stylex.ts` defines shared visual roles; components own their styles. |
| TanStack Table and Virtual | `collections` models prepared rows and bounds their rendered window. |
| TanStack Hotkeys | `collections` binds application-owned commands within their declared focus scope. |
| DayPicker | `collections` supplies calendar mechanics for explicitly supplied date selection. |
| Resizable Panels | `layout` supplies pointer and keyboard pane resizing. |
| Pierre Highlights, Diffs, and Trees | `content` owns tokenization, diff geometry, and file-tree mechanics behind Mechane APIs. |
| Streamdown | `content` parses completed or incomplete Markdown through Mechane renderers. |
| shadcn message scroller | `ai` owns scroll anchoring and live-edge following through its headless primitive. |
| visx | `charts` computes and renders geometry from supplied presentation records. |

The application supplies resource reads, mutations, routing, permissions, and record-to-presentation mappings.
The declared package edges and dependency-cruiser enforce import boundaries. Storybook builds the same components
from synthetic inputs. Lazy loading renderer code and packaged assets is component initialization, not a domain read.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `ui-core-public-entry` (065): enforced: Import another UI area through its public entry, such as `../../core/src/index.ts`; import token definitions directly
- dependency-cruiser `ui-core-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-layout-public-entry` (065): enforced: Import another UI area through its public entry, such as `../../core/src/index.ts`; import token definitions directly
- dependency-cruiser `ui-layout-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-collections-public-entry` (065): enforced: Import another UI area through its public entry, such as `../../core/src/index.ts`; import token definitions directly
- dependency-cruiser `ui-collections-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-content-public-entry` (065): enforced: Import another UI area through its public entry, such as `../../core/src/index.ts`; import token definitions directly
- dependency-cruiser `ui-content-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-ai-public-entry` (065): enforced: Import another UI area through its public entry, such as `../../core/src/index.ts`; import token definitions directly
- dependency-cruiser `ui-ai-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-charts-public-entry` (065): enforced: Import another UI area through its public entry, such as `../../core/src/index.ts`; import token definitions directly
- dependency-cruiser `ui-charts-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`

<!-- End of the generated block. -->
