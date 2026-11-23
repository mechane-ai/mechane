---
name: upgrade-elements
description:
  Upgrade `@mechane-ai/elements` in an app. Use when changing the package version, or when types, keyboard behavior or
  agent output changed after an upgrade.
---

# Upgrade Elements

Elements is below 1.0, so a minor version can remove or change an API. Upgrade one minor version at a time when the gap
is large.

1. Read the installed version: `pnpm exec mechane-elements-catalog` prints it first.
2. Change the version, install, and run this command so the skills match the new package:

   ```sh
   pnpm exec mechane-elements-catalog --install-skills .claude/skills
   ```

   Use the directory the skills were installed in before.

3. Read [the release notes](references/releases.md) for every version between the old one and the new one.
4. Run the app's type check. Fix each error from the notes. For a removed or renamed export, look up its replacement:

   ```sh
   pnpm exec mechane-elements-catalog filepicker
   ```

5. Search the app for what the type check cannot see: agent component names in an `allow` function, role or Tab-order
   assumptions in tests, and CSS that targets Elements internals. After 0.47, also search for `MAX_` limit constants,
   `selection={` and `ChartSelection`, `@visx` imports your app relied on Elements to install, chart `height` numbers,
   and `format` function props or missing `locale` props passed through spread objects.
6. Review each changed page with the `review-elements` skill. Behavior changes show in the browser, not in types.

Do not pin an old behavior back with a wrapper or a patch. Move the call site to the new API, and report anything the
new version cannot do.
