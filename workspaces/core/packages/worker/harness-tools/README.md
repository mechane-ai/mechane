# @mechane/harness-tools

The mech's pi tools and the ports they call, which the mech passes to its harness.

Layer 3 · worker · plain · consumers: `@mechane/mech`

## Layout

- `hands/`: the bash tool, which runs a command in the sandbox of the calling conversation's mech or drone.
- `memory/`: the memory tools, the handoff and the memory section.
- `threads/`: the thread tools, the drone start and the threads section.

## Use

- `mechExtensions` builds the hands, memory and threads extensions from the mech's `Hands`, `MechMemory` and
  `MechThreads` ports, with the tools a drone's conversation leaves out.
- Each port answers a tagged outcome, such as `MemoryChangeOutcome`, which the tool turns into the model's result.

## Never

- Never let a pi type cross a port.
- Never call pi from a tool that records work for the alarm, such as a drone's start.
- Never rename a tool, an extension or a section key: pi stores each in every conversation.
