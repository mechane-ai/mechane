# @mechane/testing

Smoke helpers drive the compiled CLI, browser authentication, and public Worker endpoints. They decode the shared
protocol and inspect durable actor views through the same authorized APIs the console uses.

Layer 5 · node lane · plain dialect · consumers: smoke

## Public surface

`src/index.ts` exports the scenario types and helper families:

- `auth` and `cli` create real device-authorized accounts, exercise browser forms, and run the compiled CLI.
- `mechs.ts` creates mechs, sends notifications, and reads turns, events, native history, and conversation messages.
- `compute` reads public tool results and observes real container effects through the owned fixture driver.
- `notifications.ts` signs generic external notifications for their configured recipients.
- `wait-for.ts` polls an observable state with a deadline. Provider and HTTP gates establish execution order.

The stack belongs to the caller. Helpers neither restart it implicitly nor start competing stacks. They do not import
runtime stores, invoke private implementation functions, or replace Mechane dependencies. Temporary files remain in the
stack's private state directory, and credential checks identify a leaking surface without printing its secret.
