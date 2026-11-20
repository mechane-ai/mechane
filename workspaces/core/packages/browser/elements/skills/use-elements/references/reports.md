# Loading and inspecting reports

Give the route a `LoadingScope` from `/feedback` with a navigation identity. Keep the shell mounted. Wrap the entering
page in one `ContentReveal` so its heading and body enter together. A selection change inside a page should preserve the
controls and focus.

Render the **same** `AsyncRegion` across a read's pending and ready states. Pass a skeleton matching the result geometry
as its placeholder. Mounting the region only in the pending branch discards its history and skips the ready fade. Group
values a reader compares together. Keep available filters usable and preserve usable results while refreshing the same
selection. Use the component's delay and reduced-motion behavior. On a cold document, wait for session resolution before
showing account navigation or sign-in.

For a custom plot, start with `ChartFrame` and chart tones from `/charts`. Keep data meaning in the caller. For a
calendar heatmap, give each date a square cell, align week columns and day rows to one gap, and distinguish a missing
observation from the lowest score. A visible readout should provide the date and value on hover and selection. Give
keyboard users one tab stop with arrows in the plotted directions. Pointer exit restores the selected reading.

Inspect a fast cached navigation, hold and release a slow read, then navigate away mid-read. Check that the shell and
filters stay usable, the skeleton reserves the relevant space, and late responses belong to the active selection. Check
a chart on a narrow viewport, with reduced motion, and by keyboard alone.
