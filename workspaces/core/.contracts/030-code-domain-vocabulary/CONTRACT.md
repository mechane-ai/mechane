---
name: code-domain-vocabulary
message: Name each domain concept with its one glossary word in code, output, documentation, and interface text, and never with a word it replaced.
paths: ["**/*.ts", "**/*.md", "**/*.json"]
---

## Rules

Apply these rules to identifiers, comments, command and log output, documentation, and user interface text.
Declare a glossary that gives each domain concept one word, states what the word means, and lists the words it replaced.
Keep the glossary in one place that reviewers read beside this contract, such as the copy's local adaptations or a contract that extends this one.

Name each glossary concept with its word, and give no second word to the same concept.
Never use a replaced word for the concept it was replaced for: after `invoice` replaces `bill`, an identifier, field, command, log line, heading, label, or comment that calls an invoice a bill violates this rule.
A replaced word keeps its ordinary sense, so a linked list keeps its `head` after `owner` replaces `head` for an account's owner.
Build compound names from glossary words, so an invoice's total is `invoiceTotal`, never `billTotal`.
Give a collection one name in every message, API, and output that carries it, such as `lineItems` for an invoice's lines everywhere, never `items` in one response and `lines` in another.

Configure the repository's lint to reject every identifier named exactly a replaced word that has no ordinary sense as an identifier.
Leave a replaced word that has an ordinary sense as an identifier, such as the `head` of a linked list or a regular expression's `match`, off that denylist, and check its uses in review.

## Checks

Run the repository's lint and confirm its identifier denylist holds every replaced word that has no ordinary sense as an identifier.
Search the governed files for each replaced word, including compounds, comments, and documentation, and confirm each match uses the word in its ordinary sense.
For each changed name, comment, message, or label, does a replaced word that the denylist leaves out stand for its glossary concept?
Does each concept a change introduces have a glossary word, and does each compound name the change adds use glossary words?

## Local adaptations

Use product words for product concepts and keep upstream SDK names for their own APIs. Do not rename native SDK
messages, tool calls, stream parts, or workflow identifiers to simulate the retired harness.

| Word | Meaning | Replaced words |
| --- | --- | --- |
| installation | One deployed Mechane service and its global configuration | — |
| workspace | The membership and allowance boundary containing mechs | — |
| principal | A stable authenticated identity that can hold memberships | — |
| mech | A durable agent identity with definition, memory, and execution environment | — |
| session | A conversation's native message history and original channel context | turn, work item (for this concept) |
| inbox item | An accepted input under a stable request and source identity | — |
| run | One accepted input's durable execution and terminal outcome | session (for this concept) |
| turn | The existing domain API's name for a run record | — |
| work item | A tracked piece of work with title, state, and note | session (for this concept) |
| thread | The domain API's tracked work record, or a native Slack thread when qualified | — |
| memory | A path-addressed document retained by a mech | — |
| revision | An immutable version of a mech definition | — |
| model offer | A configured model with context, output, and pricing limits | — |
| dispatch | One metered model-call attempt | — |
| allowance | The workspace's daily model-spend limit | — |
| cap | A mech's daily limit within its workspace allowance | — |
| reservation | The conservative amount held before a model request | — |
| settlement | The attempt's final charge using reported or conservative usage | — |
| sandbox | A mech's isolated execution and durable-file owner | — |
| machine | One start of the sandbox guest | — |
| execution | One sandbox command under a stable effect identity | — |
| receipt | The persisted result or uncertainty of a command or delivery | — |
| presentation | One validated json-render spec with readable fallback text | — |
| event | One recorded product occurrence, distinct from a native SDK stream chunk | — |

The registry's naming checks apply to owned concepts. Native SDK signatures and external fields keep their documented
names. A standard term with a distinct technical meaning is not a glossary violation; qualify it where a reader could
confuse the product run, Workflow run, work item, or Slack thread.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `historyWords` `old`, `new`, `legacy`, `deprecated`, `v2`, `temp`.
- owned check `banned-words` (NM-02): a ratchet until phase F1

<!-- End of the generated block. -->
