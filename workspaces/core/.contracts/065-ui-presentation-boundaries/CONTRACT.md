---
name: ui-presentation-boundaries
paths: ["packages/browser/elements/**"]
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

This contract governs one published package, `@mechane-ai/elements`. Its eleven families live under
`elements/packages`, with one manifest, version, build, and stylesheet. `console-views` may use Mechane records and
domain formatting under contract 113. A resource view does not need a duplicate type for each shared API record.

The family graph permits these dependencies:

| Family | Other families it may consume |
| --- | --- |
| `foundations` | None |
| `core` | `foundations` |
| `overlays` | `foundations` |
| `forms` | `foundations`, `core`, `overlays` |
| `feedback` | `foundations`, `core` |
| `navigation` | `foundations`, `forms`, `overlays` |
| `layout` | `foundations`, `core`, `overlays` |
| `collections` | `foundations`, `core`, `forms`, `overlays` |
| `content` | `foundations`, `core`, `forms` |
| `ai` | `foundations`, `core`, `forms`, `overlays`, `content` |
| `charts` | `foundations`, `core`, `forms`, `feedback` |

Import another family through a declared public entry. The registry explicitly permits shared foundations for
accessibility, controlled state, style composition, overlay geometry, and popup styles without exposing them to npm
consumers. Import token definitions directly, as contract 114 requires. Foundations import no other family.
Catalog stories may compose public entries together. Applications compose charts, layout, content, and AI without
adding reverse dependencies. Keep the sidebar context with its layout owner and shared chart geometry with charts.

The root entry contains basic controls, text, surfaces, and disclosure. It must not re-export heavier families.
Focused dates, commands, Markdown, code, diff, tree, and chart entries import only their required capabilities.
The chart root exposes shared frames, legends, and types rather than importing every geometry implementation.

Give each implementation library one job inside its owning family:

| Library | Owner and responsibility |
| --- | --- |
| Base UI | Accessible controls, focus, overlays, and composition in the family owning that interaction. |
| Lucide | Control and navigation icons with shared sizing. |
| StyleX | `foundations/src/tokens.stylex.ts` defines shared visual roles; components own their styles. |
| TanStack Table and Virtual | `collections` models prepared rows and bounds their rendered window. |
| TanStack Hotkeys | `navigation/src/commands` binds application-owned commands within their focus scope. |
| DayPicker | `forms/src/dates` supplies calendar mechanics for explicit date selection. |
| Resizable Panels | `layout` supplies pointer and keyboard pane resizing. |
| Pierre Highlights, Diffs, and Trees | `content` owns tokenization, diff geometry, and file-tree mechanics. |
| Streamdown | `content` parses supplied Markdown through Elements renderers. |
| shadcn message scroller | `ai` owns scroll anchoring and live-edge following through its headless primitive. |
| visx | `charts` computes and renders geometry from supplied presentation records. |

`AgentAvatar` owns its finite catalog of original identity glyphs. Their stable names are presentation data, not a
second control-icon vocabulary. The forms picker reports an appearance choice; the application owns its persistence.

The application supplies resource reads, mutations, routing, permissions, and record-to-presentation mappings.
The `/csp` entry exposes Base UI's provider for an application-supplied nonce. Applications own the security policy,
nonce generation, and hydration handoff; components must not generate a replacement nonce or relax that policy.
The declared package edges and dependency-cruiser enforce import boundaries. Storybook builds the same components
from synthetic inputs. Lazy loading renderer code and packaged assets is component initialization, not a domain read.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `ui-foundations-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-foundations-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-core-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-core-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-overlays-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-overlays-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-forms-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-forms-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-feedback-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-feedback-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-navigation-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-navigation-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-layout-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-layout-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-collections-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-collections-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-content-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-content-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-ai-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-ai-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-charts-public-entry` (065): enforced: Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries
- dependency-cruiser `ui-charts-dependencies` (065): enforced: Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`
- dependency-cruiser `ui-dates-vendor-owner` (065): enforced: Import the Elements dates API, such as `@mechane-ai/elements/forms/dates`, instead of its implementation dependency
- dependency-cruiser `ui-commands-vendor-owner` (065): enforced: Import the Elements commands API, such as `@mechane-ai/elements/navigation/commands`, instead of its implementation dependency
- dependency-cruiser `ui-tables-vendor-owner` (065): enforced: Import the Elements tables API, such as `@mechane-ai/elements/collections`, instead of its implementation dependency
- dependency-cruiser `ui-content-vendor-owner` (065): enforced: Import the Elements content API, such as `@mechane-ai/elements/content`, instead of its implementation dependency
- dependency-cruiser `ui-conversation-vendor-owner` (065): enforced: Import the Elements conversation API, such as `@mechane-ai/elements/ai`, instead of its implementation dependency
- dependency-cruiser `ui-charts-vendor-owner` (065): enforced: Import the Elements charts API, such as `@mechane-ai/elements/charts`, instead of its implementation dependency
- dependency-cruiser `ui-panes-vendor-owner` (065): enforced: Import the Elements panes API, such as `@mechane-ai/elements/layout`, instead of its implementation dependency

<!-- End of the generated block. -->
