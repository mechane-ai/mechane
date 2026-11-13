# Bash by Mechane

Pi's native Bash registration, bound to a caller's working directory and executor. Mechane and Cogent supply durable
command identity, authorization, execution, and recovery.

```ts
import { createBashRegistration } from '@mechane-ai/bash';

const bash = createBashRegistration({
  cwd: '/workspace',
  execute: async (command, options, api, context) => {
    return await commands.runOrRejoin(command, options, api, context);
  },
});
```

The abbreviated example's executor implements Pi's `ExecutionEnv.exec` contract and receives the current tool API.
Stream actual output through `options.onOutput`; return the process exit or Pi's typed execution error. Preserve output
omissions and spill paths when the transport provides them. Pi owns arguments, timeout validation, retained output,
diagnostics, and structured results. The executor owns durable joins, replay safety, cancellation, and process
deadlines.

Build with `mise -C workspaces/core exec -- pnpm --filter @mechane-ai/bash build` from the factory root. The immutable
package archive contains ESM and declarations, without workspace dependencies.
