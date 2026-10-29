# @mechane/mech

The mech Durable Object and its decisions.

Layer 5 · worker · plain · consumers: `@mechane/app`

## Layout

- `alarm/`: the alarm's run: the catch-up on pi's progress, what it owes pi, and pi's work until the alarm's bound.
- `definitions/`: revision-checked definition changes, initial identity, and retryable projection into the workspace
  roster.
- `drones/`: a drone's start, stop and end in pi, its report item, a member's cancel, and the reads of drones.
- `events/`: the list of a mech's events, which waits for the next one, and the signal its writes wake.
- `forks/`: a fork of an idle mech: its decision, the copy of its tables to the new mech's object step by step, and that
  object's receipt of each step.
- `hands/`: the hands of a mech and its drones: each execution asked of its own sandbox until it settles.
- `inbox/`: an inbox item's receipt, and the write of a silent item.
- `memories/`, `threads/`: the reads of the saved memories and of a page of threads.
- `turns/`: a turn's start and end, a member's cancel, the notes an unanswered turn owes pi, and the read of a turn.

## Use

- `MechObject` is one mech: the Worker calls its methods by RPC, and each answers the encoded form of its catalog's
  answer. Each method reads the clock once and decides in one transaction.
- Only the alarm lets pi work; a method records what pi must do and arms the alarm for now.
- A definition edit records a new revision. The next idle boundary with no running drones activates it; current turns
  and drones keep their original model, instructions, and cap. Turn records name the revision they used.
- Pause keeps queued input and lets current work finish. Archive also refuses new input. Resume releases queued work.
- Creation intents preserve identity across retries. Clone starts with an empty conversation; fork copies approved
  conversation history. Neither inherits connection grants, bindings, schedules, or delivery intents.
- The object assembles its ports from `@mechane/mech-ports` and its own hands, and passes the tools of
  `@mechane/harness-tools` to `openMechHarness`.

## Never

- Never call pi from an RPC method: pi's work outlives the call that starts it.
- Never call `sandboxStub` outside this package, or `receiveCopy` outside `forks/` (contract 055).
- Never record an effect's outcome before the effect answered; a step cut off is asked again.

## Split seam

The next member is `forks/` (172 code lines): a fork's decision, copy and receipt. `OpenedMech` and `MechHandle` move
with it to its `types.ts`, and contract 055's `copy-outside-forks` path follows it.
