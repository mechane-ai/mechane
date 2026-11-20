---
name: extend-elements
description:
  Implement or change a shared component in the Mechane Elements source repository, including its UI SDK behavior,
  StyleX appearance, or agent-visible state.
---

# Extend Elements

Find the closest component in the owning family under `packages/` and read its public entry and story. When several
controls already provide the desired behavior together, compose them in a recipe. Add a shared component when the
library needs to own a repeated interaction or prevent an invalid combination of inputs.

For a new interaction, open `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md` from the Elements package directory. This
is the guide for the pinned SDK. Use an existing UI SDK behavior where one fits. Keep one owner for keyboard, pointer,
and agent actions. Use the family's StyleX tokens and density choices and export the supported API from its public
entry.

Give interactive components a meaningful accessible name. Advertise actions only when the visible control can perform
them. Derive visible items and readings from the authorized data currently on screen. Route actions through the same
selection, navigation, or submit callback used by a person. The application supplies permissions, pending state,
accepted results, and errors. A requested change to a controlled value is complete when the owner supplies the new
state.

Check a representative task in the family story with keyboard and the public `/agent` bridge. Check what the agent sees
once the control is disabled, its selection changes, or its data is loading. For sensitive controls also inspect
compound snapshots and action results for private values. Update the page recipe if the preferred consumer composition
changes.
