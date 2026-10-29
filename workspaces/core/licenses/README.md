# Distribution licenses

These files preserve the license material shipped with Mechane's built artifacts. The JavaScript files contain only
legal comments; their license text is copied verbatim from the sources below. The Mechane notice precedes the full
Apache-2.0 text in `apache-2.0.js`. Third-party copyright holders and license terms remain unchanged.

The CLI embeds this directory as readable assets in its executable. The guest bundle includes the Mechane and Effect
notices, and the Worker imports every JavaScript notice here. The guest image also retains the Node image's
`/usr/local/LICENSE`, Debian package copyright files under `/usr/share/doc`, and `/usr/share/common-licenses`.

## Application dependencies

The CLI and guest bundle metadata contain Effect as their only external JavaScript package. The Worker source map also
contains the packages below, including `content-type` and `@cfworker/json-schema` bundled inside the MCP client. Exact
copies shared by multiple packages or versions use one file. Update these notices when the bundled dependency graph
changes; the workspace's complete development dependency list is a different inventory.

| Notice                      | Package version                                                          | Original license source                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `apache-2.0.js`             | Mechane                                                                  | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)                                                                    |
| `effect.js`                 | `effect` 4.0.7                                                           | Installed package `LICENSE`                                                                                                      |
| `jose.js`                   | `jose` 6.2.13                                                            | Installed package `LICENSE.md`                                                                                                   |
| `cookie.js`                 | `cookie` 1.1.1                                                           | Installed package `LICENSE`                                                                                                      |
| `openai.js`                 | `openai` 7.19.0                                                          | Installed package `LICENSE`                                                                                                      |
| `partial-json.js`           | `partial-json` 0.1.7                                                     | Installed package `LICENSE`                                                                                                      |
| `model-context-protocol.js` | `@modelcontextprotocol/client` and `@modelcontextprotocol/core` 2.4.0    | Identical installed `LICENSE` files, including the Apache/MIT transition notice                                                  |
| `zod.js`                    | `zod` 4.6.7                                                              | Installed package `LICENSE`                                                                                                      |
| `pkce-challenge.js`         | `pkce-challenge` 5.0.1                                                   | Installed package `LICENSE`                                                                                                      |
| `eventsource-parser.js`     | `eventsource-parser` 3.1.1                                               | Installed package `LICENSE`                                                                                                      |
| `typebox.js`                | `typebox` 1.3.27 and 1.4.3                                               | Identical installed `license` files                                                                                              |
| `pi.js`                     | `@earendil-works/pi-ai`, `pi-telemetry`, `pi-durable`, and `chord` 1.4.0 | [Pi v1.4.0, commit 4a080252](https://github.com/earendil-works/pi/blob/4a080252f06caf63a525d7873c5d94d3c23887e0/LICENSE)         |
| `content-type.js`           | `content-type` 1.0.5                                                     | [Upstream v1.0.5](https://github.com/jshttp/content-type/blob/v1.0.5/LICENSE)                                                    |
| `cfworker-json-schema.js`   | `@cfworker/json-schema` 4.1.1                                            | [Package release commit 5409fdc2](https://github.com/cfworker/cfworker/blob/5409fdc2bd144f68e8b28c61c71fcb16600000a6/LICENSE.md) |

## Bun runtime

`bun-licenses.txt` is the complete upstream
[Bun 1.4.4 license document](https://github.com/oven-sh/bun/blob/bun-v1.4.4/LICENSE.md). It states Bun's MIT license,
identifies its linked libraries and embedded polyfills, links their license sources, and describes rebuilding its
statically linked JavaScriptCore. It is an upstream inventory with links, rather than a collection of every native
dependency's full copyright and license text. Keeping it here does not establish a complete legal audit of Bun's native
runtime.

`lgpl-2.0.txt` copies the
[JavaScriptCore license](https://github.com/oven-sh/WebKit/blob/d6375c72affe0f70222cdcb45012b10f0bf3a9d5/Source/JavaScriptCore/COPYING.LIB)
from Bun 1.4.4's pinned WebKit commit. `lgpl-2.1.txt` copies the
[TinyCC license](https://github.com/oven-sh/tinycc/blob/05f0fafaa3be31e31d7b4b5c17dc60f62c991171/COPYING) from its
pinned TinyCC commit. Their pins and build instructions are in Bun's
[WebKit](https://github.com/oven-sh/bun/blob/bun-v1.4.4/scripts/build/deps/webkit.ts) and
[TinyCC](https://github.com/oven-sh/bun/blob/bun-v1.4.4/scripts/build/deps/tinycc.ts) build definitions.

To rebuild against modified runtime libraries, check out Bun at `bun-v1.4.4` and follow its license document and build
instructions, using the pinned library source above. Then build Mechane's published source with that resulting Bun
executable: from `packages/node/cli`, run
`PATH_TO_MODIFIED_BUN build src/main.ts --compile --asset=../../../licenses --outfile dist/mechane`. This source command
rebuilds the CLI; official release stamping and cross-target compilation are handled by the repository's release task.
Keep the matching Mechane source tag, lockfile, runtime source, and build instructions available alongside a binary
distribution.
