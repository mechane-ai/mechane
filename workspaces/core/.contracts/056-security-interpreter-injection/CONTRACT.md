---
name: security-interpreter-injection
message: Pass untrusted input to interpreters only as bound data, never as code, commands, query text, templates, or type-constructing serialized objects.
paths: ["packages/worker/*/src/**", "packages/shared/client/src/**", "packages/node/**"]
---

## Rules

Treat as untrusted any input from outside the process's trust boundary, including request data, uploaded files, messages, third-party responses, model output, and stored values that came from them.
An interpreter is anything that runs its input: a language's evaluate or execute facility, a shell, a query language, a template engine, and a deserializer that can construct arbitrary types.

Never pass untrusted input to a language's evaluate or execute facility, a dynamic import, or reflection that selects a type, function, or module by name.
Map untrusted names to code through an explicit allowlist of known handlers.
Run external commands with an argument list and no shell, and never interpolate untrusted input into a shell command string.
Place untrusted arguments after an end-of-options marker, such as `--`, wherever the command would otherwise read one as an option.
Bind untrusted values as query parameters, and never build query text by concatenating or formatting them.
Choose untrusted identifiers, such as a sort column or a table name, from an explicit allowlist, because parameters cannot bind identifiers.
Render templates only from trusted template source, and pass untrusted input as template variables with the engine's escaping enabled.
Escaping or filtering untrusted input does not satisfy these rules where the interpreter accepts parameters, argument lists, or variables.

Deserialize untrusted bytes only with a parser that produces plain data, such as a JSON parser or a YAML loader restricted to standard types.
Never deserialize untrusted bytes with a format or loader that can construct arbitrary types or run code on load, such as native object serialization, object-constructing YAML loaders, or model checkpoint formats that execute code.
Load code-bearing artifacts, such as plugins, serialized objects, and executable model files, only from sources verified by digest or signature.

A feature whose purpose is to run code that a user or model wrote may run it inside an isolated sandbox that holds no credentials or network access its author does not already have.

Violation: query text built as `` `SELECT total FROM orders WHERE id = '${orderId}'` `` from a request parameter.
Allowed: query text `SELECT total FROM orders WHERE id = ?` with the order identifier bound as a parameter.
Violation: a shell command string that interpolates an uploaded file's name.

## Checks

Search changed code for evaluate and execute facilities, dynamic imports, shell invocations, query construction, template rendering, and deserialization, and trace each input to its source.
Send a value containing quotes, shell metacharacters, template delimiters, and a leading `-` through each changed entry point, and confirm that it arrives as literal data.
For each deserialization of external bytes, name the format and confirm that it cannot construct arbitrary types.
Confirm that each loaded plugin or executable model file is verified by digest or signature before it loads.

## Local adaptations

SQL runs only in each Durable Object's store and in the stack's store of celld's object store, as `046-data-sql-store-boundaries` requires; every statement but a fork's copy is a literal, which ast-grep `sql-statement-not-literal` enforces, and binds every value. The copy's three statements name tables and columns that the database's own `sqlite_master` or the parent's listed, each quoted as an identifier, and bind every value; no caller's text reaches an identifier.
The memory section quotes each memory's first line in the mech's system prompt only after `escapeHtml`, so a memory cannot pose as the section's end, and it frames every memory as information, never an instruction; a memory's path admits no character that markup escapes.
The threads section quotes each open thread's title and note only after `escapeHtml` and frames them as information too; a drone's report reaches its mech as an inbox item, whose text is anyone's, as any item's is.
The pages in `packages/worker/pages/src` render literal markup, and every value from a request, the directory or GitHub, such as a key's name or a GitHub login, passes `escapeHtml` from `@mechane/utilities`; the pages' policy loads no script.
Every child process starts with an argument list, never a shell: celld and host machines in `packages/node/stack/src`, and `git`, Bun, Wrangler and the built CLI through `startProcess`; `mechane update` runs the binary it downloaded with `execFile`, once its SHA-256 matches; only the smoke pipes the served `install.sh` to `sh`, with its URL as an argument.
The served `install.sh` holds the deployment's origin as one single-quoted word, which `shellWord` from `@mechane/utilities` writes; it reads the manifest with `tr`, `sed` and `cut`, evaluates none of it, and runs a binary only once its SHA-256 matches.
Every parser yields plain data, and a schema decodes its value: JSON through `Response.json` or `Schema.fromJsonString`, JSONC through `jsonc-parser`, and, for the checks program's own configuration files, TOML through `smol-toml` and YAML through `yaml`'s core schema, which constructs no type.
Nothing evaluates code, imports a module by a computed name, or loads a code-bearing artifact.
The bash tool runs the shell text a model wrote, as `bash -c -- <text>` with an argument list, inside the mech's own sandbox, which holds no credential: a container that reaches the Internet and nothing of the node's, or, only in the smoke and in dev with the scripted upstream, a host machine that isolates nothing.
The image's base is pinned by digest, and the guest is the repository's own bundle.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
