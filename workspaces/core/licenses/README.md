# Distribution licenses

These files preserve notices shipped with Mechane artifacts. `apache-2.0.js` contains the Mechane notice and Apache-2.0
text. `effect.js` and `semver.js` copy their installed packages' MIT notices. The CLI embeds this directory. The guest
and sandbox Worker include the Mechane and Effect notices.

## Node and browser artifacts

The Node [build collector](../packages/node/server/build/licenses.mjs) writes `THIRD_PARTY_LICENSES.txt` from the
bundled programs' dependency graph and Workflow's public transform observer. It retains packaged license, notice, and
copying files. Complete MIT notices in packaged READMEs are also accepted. Missing notices require an exact-version
entry in [native/supplements.json](native/supplements.json); unknown omissions fail the build.

Supplements retain pinned upstream license text where available. Packages that publish only an MIT declaration retain
that metadata and the unmodified SPDX reference text, without inventing copyright attribution. The QuickJS supplement
also preserves its pinned QuickJS-NG license. This inventory is not a complete audit of precompiled native dependencies.

Vite generates the Console's `THIRD_PARTY_LICENSES.txt`. Its worker collector adds dependencies from worker bundles and
the embedded wa-sqlite 1.5.0 notice. The Node archive includes both inventories, linked bundle comments, `LICENSE`, and
`NOTICE`; its file inventory verifies their bytes. Review generated notices when changing dependencies or build inputs.

## Guest image

The guest image retains the Node image's `/usr/local/LICENSE`, Debian copyright files under `/usr/share/doc`, and
`/usr/share/common-licenses`. GitHub CLI 2.92.0 and mise 2026.11.2 retain their upstream MIT notices in
`/usr/local/share/licenses/mechane-tools`. The image's `gh-LICENSE` and `mise-LICENSE` copy each tool's release license.

## Bun runtime

`bun-licenses.txt` is the upstream
[Bun 1.4.4 license document](https://github.com/oven-sh/bun/blob/bun-v1.4.4/LICENSE.md). It identifies linked libraries
and embedded polyfills, links their license sources, and describes rebuilding its statically linked JavaScriptCore. It
is an upstream inventory with links, not every native dependency's full copyright and license text.

`lgpl-2.0.txt` copies the
[JavaScriptCore license](https://github.com/oven-sh/WebKit/blob/d6375c72affe0f70222cdcb45012b10f0bf3a9d5/Source/JavaScriptCore/COPYING.LIB)
from Bun's pinned WebKit commit. `lgpl-2.1.txt` copies the
[TinyCC license](https://github.com/oven-sh/tinycc/blob/05f0fafaa3be31e31d7b4b5c17dc60f62c991171/COPYING). Their build
instructions are in Bun's [WebKit](https://github.com/oven-sh/bun/blob/bun-v1.4.4/scripts/build/deps/webkit.ts) and
[TinyCC](https://github.com/oven-sh/bun/blob/bun-v1.4.4/scripts/build/deps/tinycc.ts) definitions.

To rebuild with modified runtime libraries, check out Bun at `bun-v1.4.4` and follow its build instructions. Then, from
`packages/node/cli`, run
`PATH_TO_MODIFIED_BUN build src/main.ts --compile --asset=../../../licenses --outfile dist/mechane`. Official release
stamping and cross-target compilation belong to the release task. Keep the matching Mechane source tag, lockfile,
runtime source, and rebuild instructions alongside binary distributions.
