# @mechane/console

The TanStack Start application at `/console` browses workspace agents, opens sessions, and inspects a selected session
or thread. The Worker serves its static build. The [Console guide](../../../docs/console.md) covers user flows, local
development, and deployment.

`src/application.tsx` owns browser admission. `src/workspace.tsx` owns the admitted workspace and its data runtime.
`src/managed-navigation.ts` constructs shareable agent and session routes. The managed screens compose reads, commands,
and presentation components. Their draft owner retains unsent text across navigation and cache recovery. The URL carries
the selected resources and page, so another authorized viewer can open the same records.

Workspace owners can open Settings → Archived mechs to browse historical records and their original published messages.
The read-only Archive renders recorded text and validated presentation cards and links to recorded runs.

Historical native diagnostics live under `src/screens/mech.tsx`. Run overviews link to captured evidence at
`/console/workspaces/:workspaceId/mechs/:mechId/evidence/:artifactId`. The full-page viewer uses authenticated media and
offers a return to the originating run when one was recorded. The Environment view reads checkpoint and process reports
and loads bounded output for an expanded handle.

The Vite build emits the shell, extracted StyleX styles, and dependency notices. Storybook builds component examples
through `.storybook/`.
