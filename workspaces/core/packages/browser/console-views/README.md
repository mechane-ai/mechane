# @mechane/console-views

Mechane resource views and user interactions without network or session ownership.

Conversation renders supplied events, including safe Markdown and exact-source copy actions. Historical pagination
belongs inside the transcript; new-page actions belong in its persistent controls area. The application owns live
activity and delivery receipts beside the retained composer so loading an older page cannot reset them.

WorkList and WorkDetails are separate surfaces. The application retains the list while a work record is open, preserves
the last supplied selected record across bounded refreshes, and restores the selected row on return. MemoryList requires
the originating-run link from its consumer; it does not construct application routes.
