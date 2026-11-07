# @mechane/utilities

Small promise helpers used by the sandbox's command and filesystem lifecycle.

Layer 0 · shared lane · plain dialect · any consumer

## Surface

`waitFor`, `afterSettling`, `serialCalls`, and `capturePromise`. The [entry point](src/index.ts) owns this surface.

## Use

Use `waitFor` for a duration, `afterSettling` for cleanup, and `serialCalls` when sandbox operations share mutable
resources. `capturePromise` records a native promise's outcome without hiding its failure.

## Never

Name a domain concept or import another `@mechane` package. Durable agent execution belongs to Workflow, not these
process-local helpers.
