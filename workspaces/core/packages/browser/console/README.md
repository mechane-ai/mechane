# @mechane/console

TanStack Start application at `/console`. Routes compose the data and presentation packages; the Worker serves its
static build. See the [Console guide](../../../docs/console.md) for behavior, local development, and deployment.

`src/application.tsx` owns browser sign-in state and workspace lifetimes. `src/screens/` owns commands and navigation.
The Vite build creates the shell, extracted StyleX styles, and bundled dependency notices. Storybook builds views
independently through `.storybook/`.

Run overviews link to captured browser evidence at
`/console/workspaces/:workspaceId/mechs/:mechId/evidence/:artifactId`. The viewer retains the selected workspace through
sign-in, presents source provenance, and uses authenticated media URLs. Captures document observations, not a test
verdict. A shared link requires current workspace membership. The root route keeps the same workspace and native Chat
provider mounted while a capture covers the conversation or run. Direct capture links return to the recorded session;
in-app Back also restores the originating row, draft, and scroll position.

The mech's Environment view lists active and recent managed processes with exact-machine stop controls. Bounded output
loads only when a process is expanded. Network observers detach while a run or capture covers the view, without
discarding expanded logs. Browsing this view never starts a machine, restarts a lost process, or extends the machine's
idle deadline.
