# @mechane/sandbox-service

The Cloudflare entry point for Mechane’s public hostname and its private compute boundary. Public requests stream to the
configured Modal server. `/internal/sandboxes/` routes require the runtime’s separate service key and call only the
sandbox Durable Object.

## Configure

[`src/settings.ts`](src/settings.ts) owns the namespace, R2 bucket, and deployment settings. Modal transport credentials
and the sandbox key support rotating Secrets Store bindings. The key is never sent to the guest. The proxy replaces
Modal authentication headers, strips caller-supplied forwarding headers, and does not buffer streaming responses. It
replaces `x-mechane-client-address` with Cloudflare’s connecting address for rate limiting. The private Node origin must
explicitly enable trust in that header; it is never an authentication or authorization identity.

## Use

[`@mechane/sandbox-wire`](../../shared/sandbox-wire/README.md) owns execution and maintenance schemas and path builders.
Submission commits a stable execution identity before dispatch. Observation carries no credentials. If a command has not
reached its guest, `ExecutionEnvironmentRequired` asks the runtime to resolve fresh credentials and call the same
execution’s resume route. Resume cannot create or replace a command. A different command under an existing identity
receives a conflict. Cancellation writes a tombstone even before submission, so a delayed request cannot start work.

Workspace maintenance uses a separate operation ID. Durable alarms continue it when the initiating caller disappears.
Failed maintenance releases command admission and retains the last committed snapshot and any live recovery files.

The Node runtime checks the current workspace policy and execution grant before calling this service. The service key
confers internal compute authority; no public browser or sandbox process receives it.
