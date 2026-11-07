# Presentations

Presentations use json-render's native flat spec and Chat SDK component names. The shared catalog supplies component
props to the console registry and native chat renderer. A presentation may show text, fields, a table, a chart, and
HTTPS links. Permission decisions remain Nexus operations; model output cannot create approval controls.

Parse unknown input with `PresentationSpecification`, or call `createPresentationOutput` to validate it and derive a
readable fallback. Native catalog validation checks syntax but does not enforce the complete component and graph
constraints. The branded parsed type keeps those constraints at renderer boundaries. Do not repair or silently prune
invalid specs.

The `render_ui` tool accepts a complete spec. Its native input schema describes the supported static subset; normal
agent replies remain Markdown. Catalog JSONL generation prompts do not belong in this tool-based conversation. Stream
completed tool results using json-render's `data-spec` part with `{ type: 'flat', spec }`, alongside readable text.
Retain the same spec for browser rendering and Slack's `toCard` conversion. State expressions, repeated elements,
arbitrary actions, and remote images are outside the supported subset.
