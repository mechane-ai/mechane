# @mechane/utilities

Isomorphic, domain-free functions beside Effect, and the only code that builds promises.

Layer 0 · shared lane · plain dialect · any consumer

## Surface

`escapeHtml`, `sha256Hex`, `shellWord`, `waitFor`, `settlesWithin`, `wakeList` with `WaitEnd`, `untilAborted`,
`abortRejection`, `unlessStopped`, `afterSettling` and `afterFailing`, one function per file.

## Use

Wait on time alone with `waitFor`, and ask whether work finished in time with `settlesWithin`, each for a `Duration`.
Let one wake release many waits, each until its timeout or its stop, with `wakeList`; wait for a signal's abort with
`untilAborted`, or fail at it with `abortRejection`; stop waiting for a promise when another settles with
`unlessStopped`; and run a cleanup at a promise's end with `afterSettling`, or at its failure with `afterFailing`.
Escape text for markup with `escapeHtml`, and quote a shell word with `shellWord`.

## Never

Name a domain concept, import Effect's runtime, or import another `@mechane` package. Effect's own modules come first,
so a function lands here only when Effect has none.
