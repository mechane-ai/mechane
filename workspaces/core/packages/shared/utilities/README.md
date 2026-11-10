# @mechane/utilities

Domain-free text, promise, and diagnostic helpers for runtime boundaries.

Layer 0 · shared lane · plain dialect · any consumer

## Surface

`waitFor`, `afterSettling`, `serialCalls`, `capturePromise`, `safeFailureLocation`, and `escapeHtml`. The
[entry point](src/index.ts) owns this surface.

## Use

Use `waitFor` for a duration, `afterSettling` for cleanup, and `serialCalls` when sandbox operations share mutable
resources. `capturePromise` records a native promise's outcome without hiding its failure. `safeFailureLocation` retains
bounded error names and stack locations from the caller's explicit allowlists. `escapeHtml` encodes text for the
server's HTML pages.

## Never

Name a domain concept or import another `@mechane` package. Durable agent execution belongs to Pi, not these
process-local helpers.
