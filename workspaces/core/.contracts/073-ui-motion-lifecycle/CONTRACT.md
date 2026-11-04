---
name: ui-motion-lifecycle
paths: ["packages/browser/ui/packages/**/src/**"]
message: Keep animation interruptible, reduced-motion aware, pausable, paused when unseen, and released on removal.
---

## Rules

Use motion only to show where content came from or that its visibility changed, never to delay use of the interface.
Apply input, selection, and error state changes immediately.
Limit component enter and exit transitions to opacity and transforms.
When state changes before an animation finishes, reverse or retarget it from its current state to the latest target.
Let a surface reopened during its exit animation return to open with its focus intact instead of finishing the close.
When positioning logic owns an overlay's placement, animate an inner surface, so animation never changes its anchoring or collision placement.

Honor the user's reduced-motion preference by stopping decorative movement or making it immediate, with the component usable at once.
Show a meaningful still state under reduced motion, including when the preference changes during playback.
Keep every interactive choice available under reduced motion, and show its outcome without animation.
Do not make touch, keyboard, or reduced-motion users depend on hover-driven motion.

Start automatic motion only when its element is on screen.
Give automatically started motion that lasts more than five seconds alongside other content a visible, keyboard-operable control to pause, stop, or hide it, as WCAG 2.2 success criterion 2.2.2 requires.
Never move keyboard focus as a result of automatic motion.
Pause continuous motion when its element leaves the screen or its window is hidden, and resume from the current state rather than restarting.

Release animation frames, timers, observers, media, and listeners when the animated component is removed.
Keep still layers separate from moving elements, so each frame repaints only what moves.
Use the same authored states for playback, reduced motion, and examples.

## Checks

Toggle the changed component rapidly and confirm motion reverses or retargets without a jump or a stale surface.
Enable reduced motion before load and again during playback, and confirm decorative movement stops or becomes immediate while every control stays usable.
Scroll the animated element offscreen and hide its window, and confirm motion pauses and resumes from its current state.
Remove the component mid-animation and confirm in a profiler that no frames, timers, observers, or listeners remain.
For automatic motion longer than five seconds, pause and stop it by keyboard.
For a positioned overlay, confirm animation does not change its anchor or collision placement.

## Local adaptations

Apply these requirements to implemented components that animate. Static components need no animation machinery.
Use shared motion tokens and named reduced-motion conditions from `ui/tokens`.
Base UI continues to own overlay positioning and focus; the component owns any decorative transition it adds.

Keep high-frequency controls, tab selection, tooltips, and data refreshes immediate. Dialogs use a short opacity and
small-scale transition. The left drawer follows Base UI's swipe displacement and open/close state attributes.
Use the shared duration and easing tokens; reduced motion removes transition time, while dragging follows the pointer
without easing. Do not add a timer, animation library, or second open-state owner for these transitions.

The registry permits only explicit opacity and transform transition properties and rejects transition shorthand.
It does not establish focus preservation, interruption, or reduced-motion behavior; check those in the browser.

The adopted baseline has no continuous automatic animation. If one is introduced, the pause, visibility, and cleanup
requirements apply with that implementation. No separate animation framework or test suite is required.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `ui-motion-properties` (073): enforced

<!-- End of the generated block. -->
