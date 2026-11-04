# Feedback and disclosure

Use `/overlays` for dialogs and anchored panels, `/feedback` for loading and outcomes, `/navigation` for location and
shortcuts, and `/content` for Trace. Core exports disclosure and Avatar; `/forms` owns SettingsRow and `/collections`
owns Timestamp. All paths belong to `@mechane-ai/elements`. Colocated stories document public parts and meaningful
states. They share the same compact typography, neutral borders and focus treatment as the Console.

Use `Menu` for commands and immediate choices. Its checkbox and radio items receive controlled values. Use `Select` or
`Combobox` for form values. A menu link remains a link; command eligibility belongs to the application.

Use `Popover` for an anchored panel with explicit activation. `Preview` adds supplementary information to a link on
hover or focus. Essential information remains in the destination; use a popover when touch users need to inspect it
before acting. `AlertDialog` names a consequential action and affected record. Keep the safe action first and retain the
dialog with an inline error until the application acknowledges success. These controls compose their triggers through
`render` and delegate positioning, dismissal and focus to Base UI.

`Toast.Provider` and one `Toast.Viewport` share Base UI's manager. Call `Toast.useManager` from application components,
or give the provider an application-owned manager created with `Toast.createManager`. The manager owns announcements,
limits, dismissal and pause behavior. Toasts acknowledge nonessential outcomes; actionable failures stay beside the
operation with `Notice`.

`Accordion` groups related disclosures; `Collapsible` owns a single optional region. Their controlled and default values
are mutually exclusive. They contain supplied content and do not fetch on opening. `Breadcrumb` describes location using
application-owned links. `Kbd` displays a declared shortcut and registers no listener.

`Skeleton` and `SkeletonText` provide decorative geometry inside a labelled loading region. `Loading` supplies the
existing row and detail compositions. `Spinner` is a steady busy glyph with an accessible label. These parts add no
continuous decorative motion. Keep usable content mounted during refreshes.

`Progress` describes task completion. `Meter` describes capacity or another bounded measurement. Both require a maximum,
a value and caller-formatted text. Null remains unavailable or indeterminate; zero remains zero. Unknown capacity has no
measurement geometry. Base UI owns measurement semantics, and the supplied text owns visible and accessible formatting.

`Avatar` receives its accessible label, fallback and optional image. `SettingsRow` associates its label with the
supplied `controlId`; the application owns drafts and saving. `Timestamp` renders an ISO datetime and a supplied display
label. Format that label in the application with an explicit locale and time zone.

`Trace` renders supplied steps in order. Each item receives its ID, label, exact status text and optional detail. Supply
`selected` and `onSelect` together when selection affects the application. Nested groups record a relationship the
caller already knows. Trace infers no timing, execution, nesting or causal meaning. Use `Waterfall` for measured
intervals and a plain list for records without status evidence.

The source families are [overlays](../packages/browser/elements/packages/overlays/src/popover.tsx),
[disclosure](../packages/browser/elements/packages/core/src/disclosure.tsx),
[feedback](../packages/browser/elements/packages/feedback/src/progress.tsx), and
[trace](../packages/browser/elements/packages/content/src/trace.tsx). Storybook builds those same implementations from
synthetic inputs without application providers or live services.
