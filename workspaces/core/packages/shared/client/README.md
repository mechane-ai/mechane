# @mechane/client

The isomorphic client that calls catalog operations and decodes their answers, downloads the files a deployment serves
and reads its latest release.

Layer 3 · shared lane · effect dialect · any consumer

## Surface

- Calls: `call`, `CallRequest` and `OperationCall`.
- Response limits: `Bytes`, supplied as `maxResponseBytes` on each `call`.
- Files: `download` and `latestRelease`.
- Failures: `OperationFailed`, `OriginUnreachable`, `RequestTimedOut`, `ResponseUnreadable`, its `AnswerStep`, and
  `ClientFailure`.
- Retry metadata: `RetryAfter` and `readRetryAfter`.
- Presentations: `@mechane/client/presentation` exports the canonical catalog, validators, fallback builder, and
  `toPresentationCard({ spec })` for Chat SDK adapters.

## Use

Call an operation by its catalog name with the credential its access needs, within a timeout its program bounds. An
explicit `maxResponseBytes` choice is `Option.some(Bytes)` for a byte cap before JSON decoding or `Option.none()` for a
response the caller trusts to be unbounded. Cancellation stops the body reader. An error answer decodes into
`OperationFailed` with the failure its code names, or an `UnknownFailure`.

HTTP response failures retain their status and bounded `Retry-After` metadata. The client never repeats a call; the
caller owns any retry policy, cancellation, and total deadline.

Pass an untrusted complete presentation to `toPresentationCard({ spec })` before posting it through a Chat SDK adapter.
It enforces the shared static catalog and message bounds, then returns the native card. Invalid input throws instead of
dropping unsupported content. Use `createPresentationOutput({ spec })` when a destination also needs readable fallback
text. Platform formatting and application approval controls belong to the integration.

With strict declaration checking, install the optional `@types/node` peer and include Node types. Chat SDK's
declarations refer to `Buffer`.

## Never

Follow a redirect, so a key never reaches another origin, or import `node:` or `cloudflare:` modules.
