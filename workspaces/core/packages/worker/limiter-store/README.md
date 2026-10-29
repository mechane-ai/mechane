# @mechane/limiter-store

The limiter object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/limiter`

## Layout

- `windows/`: each policy's window, with the instant it opened and the requests it counted.

## Use

- `openLimiterStore` opens the store migrated; `atomic` runs one decision and its writes as one transaction.
- `limitWindow` answers a policy's window, and none before its first request.

## Never

- Never change a deployed migration: append a migration to the store's list.
- Never decode a row outside its record function.
