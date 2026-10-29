---
name: code-comment-content
message: Write comments that state what the code cannot show, never what it already says, what it used to do, or a shape that a declaration could carry.
paths: ["**/*.ts"]
---

## Rules

Apply these rules to comments and doc comments in maintained production code, tests, and scripts.
`code-comment-attribution` separately governs comments that name contracts or review tools.
`code-comment-form` governs task markers, commented-out code, step labels, and the form, placement, and layout of comments.
A doc comment that a framework publishes as interface text, such as a command's derived help line, is interface text rather than a code comment, and these rules leave it out.
Write a plain comment only for a reason, an external constraint, an invariant, or a consequence that the code and its names cannot show.
Write a declaration's doc comment for what callers rely on beyond its name, such as what it returns, accepts, guarantees, or refuses.
Never restate the code below a comment or the name a doc comment documents, such as `// Increment the retry count` above `retries += 1` or `/** The proxy base URL. */` above `proxyBaseUrl`.
Never narrate change history, such as what the code used to do or when it changed, and record that history in commit messages and release notes instead.
Commented-out code, including an earlier implementation kept for reference, is outside these rules, so judge only the prose comments beside it.
A comment may name an earlier stored format, schema revision, provider response, or release that current code, a migration, or a test still handles.
An example is "Revisions written before format 2 list their files in each assessment."
Citing an incident or issue as the reason for current behavior, which `code-comment-attribution` allows, is not change history.
Never describe a value's shape in a comment when a type or schema can declare it, and name that declaration instead, such as "JSON that `Publication` decodes"; `code-closed-value-sets` owns declaring a set of allowed values.
When a doc comment documents a field that may hold no value, say what its absence means, such as `/** Absent when the check sent no model request. */`.
When the field can be either omitted or null, say what each means.

Violation: `/** JSON {draft, maxFiles, maxBytes}. */` above an environment variable that the `Publication` schema decodes, which repeats the schema in prose that can drift from it.
Allowed: `// The provider allows ten minutes; the issue time sits a minute back to absorb clock drift.` inside the signing function explains the external limit and the offset.

## Checks

For each comment a change adds or edits, what reason, constraint, invariant, consequence, or caller reliance does it state that the code does not?
Does any changed comment describe what the code used to do, or a shape that a declaration could carry, outside the stored-format and incident allowances?
Does each changed doc comment on a field that may hold no value say what absence means, and for one that can be omitted or null, what each means?

## Local adaptations

The `summary` of each command declaration and global flag in `packages/node/commands/src` is interface text that `--help` and the command reference publish.
The doc-comment checks of `mise -C workspaces/core run checks` read every TypeScript file: `export-doc` fails on each exported declaration without a doc comment, except a type named like a value of its file, a function's `Input` type and an `index.ts` re-export.
`absence-doc` fails on each field that may be absent and has no doc comment: an optional, nullable or `Option` property of any type, and a field of an exported schema whose own schema leaves it optional, nullable or an `Option`; whether the doc says what absence means is left to review, since no word list tells a doc that does from one that does not.
The code-style cleanup cleared both, so they are enforced, while the `short-doc` ratchet holds each doc of more than `docSentences` sentences, each sentence of more than `docSentenceWords` words, and each doc of an export that holds only its name's words.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `docSentences` 3; `docSentenceWords` 30.
- owned check `export-doc` (CD-03): enforced in phase F6
- owned check `absence-doc` (CD-04): enforced in phase F6
- owned check `short-doc` (CD-06): a ratchet until phase F6

<!-- End of the generated block. -->
