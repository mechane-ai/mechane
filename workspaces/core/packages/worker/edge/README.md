# @mechane/edge

The HTTP edge: matching, admission, decoding, one handler per operation, the install script and release files.

Layer 5 · worker · effect · consumers: `@mechane/app`

## Layout

- `operations/`: the protocol's resource folders, each file the work of the operation it is named for.
- `admission/`: admitting a request's caller by its access: its bearer key as the key's cache shard judges it, the
  workspace the path names, and its principal's rate limit.
- `routing/`: matching a request to its operation, decoding its input and serving it with its work, and the error
  response of a failure with its headers. `failure-message.ts` is the message table of every failure a response carries.
- `releases/`: the install script and the files the releases bucket holds, with their caching.

## Use

- `findRoute` matches a request to a catalog operation, and `serveNamed` admits, decodes and serves it.
- `findReleaseRoute` answers the install script and the release files, before the catalog is read.
- `peer` reads where a request came from, which the address limits count by.
- `respondFailure` answers any failure with its family's status, and `failureMessage` gives its message.

## Never

- Never decide in a handler what a Durable Object decides: a handler asks the object and answers its decision.
- Never answer a key's token or a poll token anywhere but the poll that claims it.
- Never read a GitHub or browser session here; the pages own them.
