# @mechane/client

The isomorphic client that calls catalog operations and decodes their answers, downloads the files a deployment serves
and reads its latest release.

Layer 2 · shared lane · effect dialect · any consumer

## Surface

- Calls: `call`, `CallRequest` and `OperationCall`.
- Files: `download` and `latestRelease`.
- Failures: `OperationFailed`, `OriginUnreachable`, `RequestTimedOut`, `ResponseUnreadable`, its `AnswerStep`, and
  `ClientFailure`.

## Use

Call an operation by its catalog name with the credential its access needs, within a timeout its program bounds. An
error answer decodes into `OperationFailed` with the failure its code names, or an `UnknownFailure`.

## Never

Follow a redirect, so a key never reaches another origin, or import `node:` or `cloudflare:` modules.
