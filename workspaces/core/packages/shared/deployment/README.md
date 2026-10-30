# @mechane/deployment

The deployment's variable names, secure origins, model offers and rate limits, and their schemas.

Layer 0 · shared lane · data dialect · any consumer

## Surface

- Variables: `WORKER_VARIABLES` and `ORIGIN_VARIABLE`.
- Origins: `SecureOrigin`, `LoopbackOrigin` and `OriginProtocol`.
- Models: `ModelId`, `ModelOffer`, `ModelOffersVariable` and `RATE_TOKENS`.
- Sandboxes: `SandboxProvider` and `MachinesVariable`.
- Limits: `LimitPolicy`, `RateLimit` and `RateLimitsVariable`.

## Use

Read a variable by its settings field in `WORKER_VARIABLES`, and decode its value with the schema beside it. A
credential goes only to a `SecureOrigin`.

## Never

Import another `@mechane` package: deployment sits at layer 0, beside `records`, so its two structs list their keys with
`Schema.encodeKeys` until `wireStruct` sits below it.
