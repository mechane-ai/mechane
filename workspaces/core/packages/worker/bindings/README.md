# @mechane/bindings

The Worker's Effect side of its bindings: settings and calls to each object.

Layer 3 · worker · effect · consumers: `@mechane/edge`, `@mechane/pages` and `@mechane/app`

## Layout

- `settings/`: decoding the Worker's environment into its `WorkerSettings`.

## Use

- `decodeSettings` decodes every variable and binding once per request; it is the Worker's only reader of its
  environment.
- `callDirectory`, `callWorkspace`, `callMech` and `callKeyCache` call an object and decode its answer through
  `callObject`. A call that rejects or answers another shape fails as `ObjectUnavailable`.
- `limitRequest` counts a request against a policy's window and fails as `RateLimited` when the window is full.
  `limitAddress` does so only when the platform names the request's address.
- `readinessStubs` names the object of each class that readiness opens to prove its migrations.
- Local bootstrap is an optional redacted setting; configuring it on a non-loopback origin fails closed.

## Never

- Never decide here what an object decides: a call asks the object and decodes its decision.
- Never read the Worker's environment outside `decodeSettings`.
