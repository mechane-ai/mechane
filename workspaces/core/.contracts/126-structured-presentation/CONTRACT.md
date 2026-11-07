---
name: structured-presentation
message: Render one bounded native json-render spec through Chat SDK and Mechane Elements without granting model-authored authority.
paths: ["packages/shared/protocol/src/presentation/**", "packages/node/runtime/src/{channels,execution,tools}/**", "packages/browser/console-views/**", "packages/browser/console/src/**"]
---

## Rules

Declare the supported json-render catalog and complete spec validator once in `@mechane/protocol/presentation`.
Derive types from that native schema. Use the same validated spec for Chat SDK cards and the Console's React registry;
keep platform layout differences inside renderers. Do not introduce a parallel JSON UI protocol or duplicate catalog.

Keep ordinary agent replies in Markdown. Request structured output through `render_ui` with a complete spec and put
its generation guidance on the native tool schema. Do not inject catalog JSONL generation prompts into the agent's
conversation instructions. Validated tool output supplies native `data-spec` parts and the channel presentation.

Bound nodes, text, nesting, collections, and media before retaining a complete presentation. Keep readable fallback
text with the output. Treat partial streamed specs as provisional; invalid completion replaces them with a useful
fallback and reports the rendering failure without changing the execution result.

The Console registry composes Mechane Elements and the native json-render React renderer. Product-neutral visual
primitives stay in Elements. Catalog component names select only registered components; they cannot select modules,
HTML, scripts, credentials, or arbitrary network requests. Validate link protocols and escape supplied text.

Keep the catalog static. `Actions` groups HTTPS navigation links; it cannot execute operations. Reject event handlers,
action buttons, state expressions, repeated elements, and remote images. Opening a link does not grant permission:
the destination checks its own current authority. Nexus owns approval controls outside model-authored presentations.

Persist one canonical presentation beside its message. SDK-native message parts reference that value without
creating a competing transcript. Unsupported clients receive the readable fallback. Native tool input/output and
trace projections omit credential material before reaching either renderer.

## Checks

Type-check the catalog against both native renderers. Render representative text, links, fields, tables, and charts
through the same spec in Slack and the Console. Review component registration and link rendering for dynamic imports,
unsafe URL protocols, raw HTML, and executable callbacks.

Inspect a provider request to confirm that presentation guidance describes tool arguments without changing the
assistant's reply format. Replay a structured tool result through the native UI reader and retained history.

Exercise an oversized spec, invalid final stream, unsupported component, and attempted event handler. Verify useful
fallback text and no repeated agent work. Existing presentation, accessibility, loading, and cache contracts continue
to govern the Console.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `structured-renderer-owner` (126): enforced: Render catalog specifications through the product registry, such as `console-views/src/structured`

<!-- End of the generated block. -->
