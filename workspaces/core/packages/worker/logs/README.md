# @mechane/logs

The Worker's one log channel.

Layer 2 · worker · plain · consumers: `@mechane/harness`, `@mechane/harness-tools`, `@mechane/bindings`,
`@mechane/edge`, `@mechane/pages` and every object

## Use

- `writeLog` writes one `LogLine`, the protocol's schema of every line, as one JSON line.
- `errorCode` names an error in a line by its tag or its name in snake case, and `unknown` for any other.

## Never

- Never write to the console anywhere else in the Worker or its objects.
- Never put an error's message, a mech's text, a command or a token in a line: a line holds ids and codes only.
