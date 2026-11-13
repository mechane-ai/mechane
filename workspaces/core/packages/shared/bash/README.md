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

Executors must return an observed exit code for completed commands. Missing outcome evidence is a typed error, never
exit zero. Reject unsupported timeouts before dispatch instead of silently shortening them. Output capture belongs to
the sandbox provider: keep model excerpts small, retain a bounded file when possible, and report whether that file is
complete. The tool stays Bash; file inspection and application operations use ordinary programs and installed CLIs.
Runtime compatibility fixes belong in their owning source distributions, never consumer patch files.
