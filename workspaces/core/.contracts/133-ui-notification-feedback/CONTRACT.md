---
name: ui-notification-feedback
paths: ["packages/browser/elements/packages/feedback/**","packages/browser/console/**","packages/browser/console-views/**"]
message: Present concise application-owned outcomes through the shared notification API and keep failures with their affected task.
---

## Rules

Use the Elements `toast` API for notifications. Sonner belongs only to the shared renderer and notification adapter.
Supply plain-text titles and descriptions, with at most one labelled action. Put longer explanations in the relevant view.
Keep compact text and actions readable at narrow widths and enlarged text sizes.

Let the application decide whether a notification is needed. Page entry and background status inspection do not create notifications.
Present failed initial reads beside their recovery action and field validation beside its field.
A failed refresh may notify once while retaining usable content. Give each failure one presentation owner.

Use a stable ID for loading updates and retained failures. Update that ID rather than adding another notification.
Keep actionable and loading notifications available until their outcome or dismissal. The application dismisses its own notifications on recovery, navigation or access loss.
Keep requests, retry decisions and permission checks in the application. Sonner owns the queue, swipe, announcements and dismissal mechanics.

Keep the visible message to one title line and one description line. Text may grow with the user's font settings; actions remain reachable. A detail action opens the complete explanation in its owning view.

## Checks

TypeScript checks the supported notification payload. The `ui-toast-vendor-owner` dependency rule restricts direct Sonner imports.
Use the Toast catalog examples to update one loading notification, retry a retained failure and inspect a long message at phone width.
Check that the same ID updates one notification, actions remain reachable by keyboard and recovery dismisses only the owning notification.
Review the consuming application's trigger: does this outcome need interruption, or does it belong beside the current task?

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `ui-toast-vendor-owner` (133): enforced: Import Elements notifications, such as `import { toast } from "@mechane-ai/elements/feedback"`; Sonner belongs only to the adapter and renderer (133)

<!-- End of the generated block. -->
