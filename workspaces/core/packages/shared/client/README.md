# @mechane/client

Mechane uses the official Anthropic SDK for the Managed Agents API. This package supplies the Console's browser binding,
the client for native installation operations, and shared presentation helpers.

## Managed Agents

Use the official SDK with the installation base URL and an authorized credential for public `/v1` calls. The SDK exposes
agents, environments, sessions, and session events. A Console session link identifies an agent and a session as separate
resources.

`@mechane/client/managed` exports `createConsoleManagedClient` for an already-admitted browser workspace. It returns an
Anthropic SDK instance bound to the same-origin `/console-api` gateway, the workspace header, and the caller's abort
signal. The HTTP-only session cookie authenticates requests. Reads and mutations share that browser lifetime. The
binding disables automatic SDK retries and reports an expired session to its owner. A caller can reconcile a send
against authoritative history before deciding whether to repeat it.

## Native installation operations

`call`, `OperationCall`, and `CallRequest` use the installation operation catalog and decode its declared answers. Use
these for installation authentication and native diagnostics such as trace and capture reads. Each call takes a bound
timeout and an explicit `maxResponseBytes` choice. Supply `Option.some(Bytes)` to cap a response before JSON decoding,
or `Option.none()` to accept an unbounded response. Cancellation stops the body reader.

Failures distinguish server refusal, an unreachable origin, a timeout, and an unreadable answer. HTTP failures retain
status and bounded `RetryAfter` metadata. The caller owns its retry policy and deadline. The package also exports
`download` and `latestRelease` for deployment files and release information.

## Structured presentations

`@mechane/client/presentation` exposes the canonical json-render catalog, validators, fallback builder, and Chat SDK
card conversion. Validate an untrusted presentation with `toPresentationCard({ spec })` before posting it through a Chat
SDK adapter. Use `createPresentationOutput({ spec })` when a destination needs readable fallback text. Platform
formatting and application approvals belong to the integration.
