# Repository contracts

These rules apply throughout the factory. Contracts 001 to 009 are adopted from
[tenet-contracts](https://github.com/macromackie/tenet-contracts) v11.0.0 and recorded in [.tenet.lock](../.tenet.lock);
each one's `paths` narrow it to the files it governs, and its `## Local adaptations` hold this repository's values.
The [product contracts](../workspaces/core/.contracts/index.md) add the code, CLI, data and test rules of `workspaces/core`.

## Tests

- [Test curation](001-test-curation/CONTRACT.md): one smoke; a scenario only for a consequential guarantee in the catalog.
- [Assertion integrity](002-test-assertion-integrity/CONTRACT.md): change code to satisfy a check, never the check to fit code.

## Checks

- [Reproducible checks](003-ci-reproducible-checks/CONTRACT.md): one `mise run check`, pinned tools, locked installs.
- [Check trust](004-ci-check-trust/CONTRACT.md): one read-only workflow with hash-pinned actions and no cache.

## Contracts, context and documents

- [Contract maintenance](005-contract-maintenance/CONTRACT.md): scoped contracts whose declared values the tools enforce.
- [Context notes](006-context-note-curation/CONTRACT.md): dated, sourced notes; task progress stays in GitHub.
- [Agent instruction files](007-context-agent-instruction-files/CONTRACT.md): one accurate AGENTS.md within its word budget.
- [Prose style](008-docs-prose-style/CONTRACT.md): short sentences and paragraphs, within the declared limits.
- [README structure](009-docs-readme-structure/CONTRACT.md): what the project is and how to start, within its word budget.
