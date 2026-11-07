# @mechane/client

The isomorphic client that calls catalog operations and decodes their answers, downloads the files a deployment serves
and reads its latest release.

Layer 2 · shared lane · effect dialect · any consumer

## Surface

- Calls: `call`, `CallRequest` and `OperationCall`.
- Response limits: `Bytes`, supplied as `maxResponseBytes` on each `call`.
- Files: `download` and `latestRelease`.
- Failures: `OperationFailed`, `OriginUnreachable`, `RequestTimedOut`, `ResponseUnreadable`, its `AnswerStep`, and
  `ClientFailure`.
- Retry metadata: `RetryAfter` and `readRetryAfter`.

## Use

Call an operation by its catalog name with the credential its access needs, within a timeout its program bounds. An
explicit `maxResponseBytes` choice is `Option.some(Bytes)` for a byte cap before JSON decoding or `Option.none()` for a
response the caller trusts to be unbounded. Cancellation stops the body reader. An error answer decodes into
`OperationFailed` with the failure its code names, or an `UnknownFailure`.

HTTP response failures retain their status and bounded `Retry-After` metadata. The client never repeats a call; the
caller owns any retry policy, cancellation, and total deadline.

## Never

Follow a redirect, so a key never reaches another origin, or import `node:` or `cloudflare:` modules.
