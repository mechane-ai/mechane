# @mechane/owned-rules

The owned rules and checks that no installed tool runs: the documents, the pins, the orphans, the source's comment width
and patterns, and the doc-comment, span-name, logical-operator and banned-word sites.

Layer 5 · node lane · effect dialect · consumers: checks

## Layout

- `src/`: every owned site of a source, the pins, the orphans and the span names.
- `src/documents/`: the documents' word budgets, their prose limits and the workflows' pinned actions.
- `src/source/`: each source's comment width, logical operators and the shared patterns.
- `src/doc-comments/`: supported public interfaces and the quality of every authored doc comment.
- `src/vocabulary/`: the glossary's banned phrases and the history words, in names, comments and documents.

## Rules

The [product contracts](../../../.contracts/index.md) apply; each owned rule's contract names it in its local
adaptations.

## Use

`checks` runs each check here on the members, the tracked files and the parsed sources it reads once, and holds each
ratchet's sites to its baseline. A rule's `violation` and `allowed` examples run through the same functions.

## Never

- Never read a source here that the caller did not parse; every rule shares one parse of each file.
