# @mechane/console-views

Presentation components for the Console. The application supplies records, navigation targets, and action callbacks. The
data package owns HTTP, streaming, and cache admission.

`src/managed/` contains the agent and session lists, setup forms, thread picker, transcript, composer, and status
indicators. `ManagedSessionList` accepts the current execution owner separately from the public session status.
`SessionTranscript` renders projected, ordered events with their thread and tool attribution. An approval control
requires a pending event ID and a decision callback. `SessionComposer` accepts the application’s draft and send state.

The managed evidence list and detail view show captures for the selected session. The detail view takes the
authenticated media URL and playback state from its host. Session, environment, work, generation, and action IDs come
from the capture’s installed-worker origin. Older receipts without that origin show its absence. The same media viewer
renders native and managed captures while each view labels its own execution identifiers.

Native diagnostic views render recorded run and request details, event history, captured evidence, and environment
reports. `EvidenceDetails` takes authenticated media URLs and shows capture provenance and availability.
`EnvironmentProcesses` exposes expansion and stop callbacks for a specific process handle. The application decides when
to fetch logs and how to handle an unsuccessful command.

`ArchivedConversation` renders historical publications supplied by the operator archive. Recorded structured cards use
the json-render registry and the shared catalog’s Zod peer. The archive has pagination and run links. The managed
session composer belongs to the live session view.
