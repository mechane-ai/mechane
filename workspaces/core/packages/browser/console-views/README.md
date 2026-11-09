# @mechane/console-views

Mechane resource views and user interactions without network or session ownership.

MechConversation renders supplied public messages, safe Markdown, and validated structured presentation. Assistant
messages come from explicit publication; private model output belongs to activation inspection. The application owns
bounded history, its retained composer, and refresh. Activation and evidence navigation preserve that conversation owner
and reader position.

The exact Zod peer matches the protocol's json-render catalog. Its React renderer and the shared catalog must use the
same native schema types.

EvidenceList and EvidenceDetails render supplied capture records, provenance, and authenticated media URLs. The
application owns navigation, sign-in, reads, and authorization. Capture readiness describes saved media, not an
application test verdict.

EnvironmentProcesses renders active and recent summaries; its detail slot exposes expansion state so the application
fetches logs only for opened handles. EnvironmentProcessOutput renders supplied bounded output. The application owns
refresh, exact-machine stop commands, pending state, and failures. Running means the process is alive; it does not
establish server readiness.
