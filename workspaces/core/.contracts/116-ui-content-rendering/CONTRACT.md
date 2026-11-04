---
name: ui-content-rendering
message: Display supplied text and files safely, preserving their identity, readable fallback, and bounded inspection.
paths: ["packages/browser/ui/packages/content/**"]
---

## Rules

Treat Markdown, source, patches, structured values, and recorded output as data. Keep raw HTML and executable content
out of the render path. Admit links through an explicit protocol policy and make remote media loading an intentional
consumer choice. Strip terminal control behavior rather than interpreting recorded output as terminal commands.
Applications redact private values before passing them to these generic viewers.

Keep the supplied text available when a renderer is loading, unsupported, or failed. SSR and first client render must
agree on the readable fallback. A highlighting failure must not hide the source. Load renderer code, grammars, workers,
and WebAssembly through packaged assets; do not fetch them from an implicit third-party service.

Preserve source whitespace and copy the supplied text rather than rendered markup. Invalidate renderer state when
the supplied file identity, source, or explicit revision changes. Line coordinates are one-based; diff annotations
distinguish old and new sides. Report file, line, and frame selection through callbacks or application-supplied destinations.

Keep Pierre model state under one adapter. Apply later paths, statuses, selection, and composition updates to the
persistent tree model instead of treating initial options as live props. Clean up subscriptions and obsolete async
renderer work when its owning input changes or unmounts.

Bound nested or large output with visible truncation or a declared render window. Preserve the full supplied copy
value where copying is supported. A collapsed, truncated, missing, or empty value must have its own truthful state.
Use one token-based theme bridge for vendor content, including its Shadow DOM, so light and dark match the surrounding
Mechane controls. Keep vendor implementation types and worker configuration out of the public component API.

## Checks

Inspect completed and incomplete Markdown, unsafe links and HTML-like text, unsupported code, changed revisions,
empty output, and declared truncation through the public components. Confirm no supplied text executes or silently
loads remote media. Compare copied text with the supplied whitespace and line endings.

Change a mounted tree's paths, statuses, and selected item; confirm its public callbacks and visible focus agree with
the new inputs. Inspect selection and annotations on both sides of a changed diff.

Build the package and an ordinary React consumer. Confirm source remains readable before renderer initialization and
that every dynamic asset resolves from the packaged build. Inspect vendor content in both themes and a narrow layout.
Types, existing dependency checks, and this source/browser review enforce the contract; no new test runner is required.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
