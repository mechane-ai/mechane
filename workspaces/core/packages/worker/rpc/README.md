# @mechane/rpc

Each Durable Object's RPC answers, its callee edge and plain caller, and the bindings' types and object settings.

Layer 2 · worker · plain · consumers: `@mechane/bindings`, every object, `@mechane/edge`, `@mechane/pages` and
`@mechane/app`

## Layout

- `stubs/`: one stub per object class, each under the object name its builder derives from what the object holds.
- `mech/`: the mech object's method inputs and its turn and fork answers.

## Use

- Each object's `*.types.ts` declares its RPC methods and inputs, and its `*.schemas.ts` the answers they return. The
  callee answers an answer's `Encoded` form, and the caller decodes it with the same schema.
- `directoryStub`, `workspaceStub`, `mechStub`, `sandboxStub`, `keyCacheStub` and `limiterStub` name the object that
  holds a given directory, workspace, mech, sandbox, token hash or counted client.
- `objectSettings` decodes the environment a mech's object reads as it opens, and `objectBindings` names the Durable
  Object namespaces.
- `SANDBOX_IDLE`, `STOP_RETRY` and `MACHINE_LEASE` are the machine windows that the sandbox and the workspace share.

## Never

- Never answer a class instance or an Effect across RPC: answers are plain data that a schema decodes.
- Never derive an object's name anywhere but its stub's builder, so one id always reaches one object.
