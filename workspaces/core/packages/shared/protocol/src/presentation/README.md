# Presentations

Presentations use json-render's native flat spec and Chat SDK component names. The [shared catalog](catalog.ts) defines
static text, fields, tables, charts, and HTTPS links for Console rendering. Model output cannot grant permissions or
create approval controls.

Agents publish through [`console_message({text, presentation})`](../../../../node/runtime/src/tools/console-message.ts),
with optional structured presentation alongside required text. The tool stores a validated `{spec, fallback}` with the
public Console message. Native execution output remains in run inspection. Completing a run does not publish a reply.

Parse unknown input with `PresentationSpecification`, or call [createPresentationOutput](create-presentation-output.ts)
to validate it and derive a readable fallback. Native catalog validation checks syntax but does not enforce the complete
component and graph constraints. The branded parsed type keeps those constraints at renderer boundaries. Do not repair
or silently prune invalid specs.

External package consumers import `@mechane/client/presentation`. Its `toPresentationCard({ spec })` validates a
complete spec and converts it with the same bounded components and limits. Integrations pass the resulting native Chat
SDK card to their platform adapter and keep approval controls application-owned.

External integrations own addressed messages and channel-specific rendering through their installed tools. State
expressions, repeated elements, arbitrary actions, and remote images are outside the supported presentation subset.
