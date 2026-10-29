# @mechane/limiter

The limiter Durable Object and its decisions.

Layer 4 · worker · plain · consumers: `@mechane/app`

## Layout

- `windows/`: a request's take from its policy's window, which opens a window once the last one ended.

## Use

- `LimiterObject` holds the windows of one address, principal or GitHub user, one per policy, so neither an eviction nor
  a deploy forgives a client.
- `take` counts one request against its policy's limit, or refuses it until the full window ends.

## Never

- Never count a request outside its policy's window.
- Never make an outbound call: `take` decides and writes synchronously.
