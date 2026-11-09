---
name: structured-presentation
message: Publish bounded json-render presentations only through explicit communication tools without granting model-authored authority.
paths: ["packages/shared/protocol/src/presentation/**", "packages/node/runtime/src/{execution,tools}/**", "packages/browser/console-views/**", "packages/browser/console/src/**"]
---

## Rules

Declare the supported json-render catalog and complete spec validator once in `@mechane/protocol/presentation`.
Derive types from that native schema. The Console's React registry consumes the validated spec. Platform renderers live
with their integration owner and may map the catalog without introducing another Mechane spec or authority model.

Keep text and presentation publication explicit. The `console_message` tool accepts readable text and an optional complete
presentation for the current mech's public Console conversation. Put presentation guidance on its native argument schema.
Do not inject catalog-generation prompts into conversation instructions or publish final model text automatically.
A presentation recorded in private tool activity is not proof that an outward message was sent.

Bound nodes, text, nesting, collections, and media before retaining a complete presentation. Keep readable fallback text
with each published message. Reject invalid complete specs without creating blank success or repeating agent work.
Treat any provisional renderer state as provisional rather than a durable published message.

The Console registry composes Mechane Elements and the native json-render React renderer. Product-neutral visual
primitives stay in Elements. Catalog names select only registered components, never modules, HTML, scripts, credentials,
or arbitrary network requests. Validate link protocols and escape supplied text.

Keep the catalog static. `Actions` groups HTTPS navigation links; it cannot execute operations. Reject event handlers,
action buttons, state expressions, repeated elements, and remote images. A destination checks its own current authority.
Application approval controls belong to the application and are not model-authored execution capabilities.

Persist one canonical presentation with its public message and stable communication receipt. Unsupported clients receive
the same readable fallback. Keep private model context and credential-bearing arguments out of the public transcript.
Native execution traces remain a distinct authorized projection.

## Checks

Type-check the catalog against its native renderer. Render text, links, fields, tables, and charts through the Console
registry. Inspect registration and link rendering for dynamic imports, unsafe URL protocols, raw HTML, and callbacks.

Inspect a provider request to confirm presentation guidance describes explicit tool arguments. Complete an activation
without the communication tool and verify no message appears. Replay an explicit publication with the same effect
identity and verify one canonical public message and presentation.

Exercise an oversized spec, unsupported component, attempted event handler, and unavailable renderer. Confirm readable
fallback, no unauthorized operation, and no repeated agent work. Existing accessibility, loading, and cache contracts
continue to govern the Console.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `structured-renderer-owner` (126): enforced: Render catalog specifications through the product registry, such as `console-views/src/structured`

<!-- End of the generated block. -->
