# Agent access

Elements components describe themselves to an agent: a name, a label, their state, their items and the actions a person
could take. The bridge is optional. Nothing is exposed until the application creates it.

## Turn it on

Create the bridge in client code at browser startup:

```ts
import { createAgent, registerTools } from '@mechane-ai/elements/agent';
import type { AgentAction } from '@mechane-ai/elements/agent';

const allow = (step: AgentAction) =>
  step.confirm === undefined && step.component === 'collection-query' && step.action === 'setQuery';

const agent = createAgent({ allow });
const unregister = registerTools(agent, { allow });
// Call unregister() when the host ends this integration.
```

- `agent.snapshot()` lists the mounted components with their state and actions. `agent.query(...)` finds components and
  list items. `agent.act({ steps })` runs steps in order.
- For the app's own model, pass the definitions in `agentTools` to the model and route each call to the matching method.
- `registerTools` exposes the same tools to a browser agent through WebMCP. It needs `allow`.
- `allow` decides each step. Start by allowing the few actions the product needs. A step with `confirm` set is one a
  person must approve, such as Send, Stop or an approval decision.

## What an agent can read and do

| Component            | It reads                                         | It can ask for                                       |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `collection-query`   | The search text and filter choices               | `setQuery`, `submitSearch`, `setFilter`              |
| `collection-results` | Every supplied row as a named item, and `status` | `sort`, `select`, `open`, `previousPage`, `nextPage` |
| `chart`              | Each item with exact values, inspected, selected | `inspect`, `select`, `dismiss`                       |
| `chart-range`        | The selected range                               | `setRange`, `clear`                                  |
| `link`               | `href` and whether it is current                 | `follow`                                             |
| `page-title`         | The page's title                                 | Nothing                                              |
| `page-section`       | The section at the reading position              | Nothing                                              |
| `detail-field`       | A labeled field of the selected record           | Nothing                                              |
| `form-status`        | Pending, error or success, with its message      | Nothing                                              |
| `message`            | A message's author, kind and text                | Nothing                                              |
| `viewer`             | A code, diff, JSON, log or stack viewer's label  | Nothing                                              |

Form controls, menus, dialogs, tabs and the other controls appear under their UI SDK names with their own actions. Read
`agent.snapshot()` in the running app for the exact list.

## Rules for the application

- An agent's step goes through the same callback as a person's press. `details.source` is `agent` in that callback.
- A requested change to a controlled value is complete only when the application supplies the new state. After a step,
  read the result again. Wait for `collection-results` to report `status: 'ready'`; a pending read can keep old rows.
- A refused step explains itself, for example with the columns a table can sort by. Let the agent read the refusal.
- Advertise an action only when the visible control can perform it. Disable the control and the action together.
- Keep credentials and private values out of labels, descriptions and results. Set `isSensitive` on `Field.Root`.
- The bridge is not authorization. The server authorizes every read and mutation.
- Give every interactive component an accessible name. An agent finds a component by its name and label.
