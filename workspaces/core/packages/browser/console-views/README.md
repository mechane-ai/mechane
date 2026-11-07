# @mechane/console-views

Mechane resource views and user interactions without network or session ownership.

MechConversation renders supplied native AI SDK messages, safe Markdown, tool results, and validated structured
presentation. The application owns the Chat instance, session selection, streaming, bounded history, and the retained
composer. Run and evidence navigation must preserve that session owner; domain read caches do not own a second
transcript.

WorkList and WorkDetails are separate surfaces. The application retains the list while a work record is open, preserves
the last supplied selected record across bounded refreshes, and restores the selected row on return. MemoryList requires
the originating-run link from its consumer; it does not construct application routes.

EvidenceList and EvidenceDetails render supplied capture records, provenance, and authenticated media URLs. The
application owns navigation, sign-in, reads, and authorization. Capture readiness describes saved media, not an
application test verdict.

EnvironmentProcesses renders active and recent summaries; its detail slot exposes expansion state so the application
fetches logs only for opened handles. EnvironmentProcessOutput renders supplied bounded output. The application owns
refresh, exact-machine stop commands, pending state, and failures. Running means the process is alive; it does not
establish server readiness.
