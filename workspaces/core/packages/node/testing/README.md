# @mechane/testing

Smoke helpers drive the compiled CLI, browser authentication, and public runtime endpoints. They use the shared protocol
decoders and the AI SDK's native UI stream parser instead of reimplementing either wire format.

Layer 5 · node lane · plain dialect · consumers: smoke

## Public surface

`src/index.ts` exports the scenario types and helper families:

- `auth` and `cli` create real device-authorized accounts, exercise browser forms, and run the compiled CLI.
- `chat` sends native UI messages and reads their streams and canonical conversation records.
- `mechs.ts` creates mechs, sends inputs, and reads terminal runs through public APIs.
- `compute` reads public tool results and observes synthetic sandbox effect gates.
- `nexus` and `slack` configure integrations through public APIs and sign external-provider events.
- `wait-for.ts` polls an observable state with a deadline. Provider and filesystem gates establish execution order.

The stack belongs to the caller. Helpers neither restart it implicitly nor start competing stacks. They do not import
runtime stores, invoke private implementation functions, or replace Mechane dependencies. Temporary files remain in the
stack's private state directory, and credential checks identify a leaking surface without printing its secret.
