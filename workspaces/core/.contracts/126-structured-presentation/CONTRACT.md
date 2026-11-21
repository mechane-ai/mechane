---
name: structured-presentation
message: Publish bounded json-render presentations only through explicit communication tools without granting model-authored authority.
paths: ["packages/shared/presentation/**", "packages/shared/client/**", "packages/browser/console-views/**", "packages/browser/console/src/**"]
---

## Rules

Declare the supported json-render catalog and complete spec validator once in `@mechane/presentation`.
Derive types from that native schema. The Console's React registry consumes the validated spec. Platform renderers live
with their integration owner and may map the catalog without introducing another Mechane spec or authority model.

Managed Agents session events use Anthropic's documented content blocks. Keep card fields out of those envelopes and
render Markdown text as text content. External deliveries publish only through the integration's communication tool
after decoding the bounded catalog spec and retaining a readable fallback.

Bound nodes, text, nesting, collections, and media before retaining a complete presentation. Keep readable fallback text
with each published message. Reject invalid complete specs without creating blank success or repeating agent work.
Treat any provisional renderer state as provisional rather than a durable published message.

The Console registry composes Mechane Elements and the native json-render React renderer. Product-neutral visual
primitives stay in Elements. Catalog names select only registered components, never modules, HTML, scripts, credentials,
or arbitrary network requests. Validate link protocols and escape supplied text.

Keep the catalog static. `Actions` groups HTTPS navigation links; it cannot execute operations. Reject event handlers,
action buttons, state expressions, repeated elements, and remote images. A destination checks its own current authority.
Application approval controls belong to the application and are not model-authored execution capabilities.

Preserve a canonical card with its recorded publication and stable communication receipt. Unsupported clients must
receive the readable fallback. Keep private model context and credential-bearing arguments out of the transcript.

## Checks

Type-check the catalog against its native renderer. Render text, links, fields, tables, and charts through the Console
registry. Inspect registration and link rendering for dynamic imports, unsafe URL protocols, raw HTML, and callbacks.

Open a recorded native publication with a structured card as an authorized owner. Verify that a member cannot read
the archive and that an ordinary managed-session message containing JSON displays as message content. Inspect an
external communication receipt to distinguish sending a card from generating a proposed card.

Exercise an oversized spec, unsupported component, attempted event handler, and unavailable renderer. Confirm readable
fallback, no unauthorized operation, and no repeated agent work. Existing accessibility, loading, and cache contracts
continue to govern the Console.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `structured-renderer-owner` (126): enforced: Render catalog specifications through the product registry, such as `console-views/src/structured`

<!-- End of the generated block. -->
