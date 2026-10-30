---
name: code-spelled-out-names
message: Spell out every word of every declared name, case acronyms as words, map `get`, `fetch`, and `load` to `read`, and ban one-character names in every language's lint.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Apply these rules to every name a change declares: variables, parameters, callback parameters, fields, functions, methods, types, type parameters, constants, enum members, and schema keys.
Exempt generated files and copied third-party source from these rules by a path pattern declared in the lint configuration, and apply the rules to the source that the repository writes as a generator's input.
Declare one list of word replacements for the repository, each mapping an abbreviation or a spelling variant to the one word that replaces it, such as `dir` to `directory`, `ctx` to `context`, `err` to `error`, and `colour` to `color`.
Keep that list in one place, and configure every language's lint from it, so that no language's lint misses a listed word.
Configure the repository's lint to reject a declared name that holds a listed word as any of its words, in any case style, such as `dir`, `orderDir`, `order_dir`, or `ORDER_DIR`.
When a language's lint cannot match a word inside a name, check that language's compound names in review.
Configure the lint to reject a declared name of one character, including a callback's parameters, such as `(a, b) => a.total - b.total`.
Name every type parameter with a word for what it stands for, such as `Row` in `readFirst<Row>` or `Catalog`.
Treat a mapped type's key, an inferred type, a type variable that an assignment declares, a const generic parameter, and a lifetime parameter, such as `'input`, as type parameters.
`_` for a value that the code never reads is allowed.
Never declare a name that the code already binds where the declaration appears, in an enclosing scope or earlier in the same block, in every language.

Map `get`, `fetch`, and `load` to `read` in the list, so that every lookup of one value starts with `read`, whatever its medium, such as `readInvoice` for `fetchInvoice`.
Start a search by a condition with `find`, such as `findOverdueInvoice`, and a lookup of many values with `list`, such as `listInvoices`.
An accessor's `get` keyword, as in `get total()`, is not part of its name, which is `total`.
Every language's lint holds these mappings, even a language that defines `get` as a keyword.

Declare beside the list the acronyms that readers outside the repository know as words, such as `id`, `api`, `url`, `json`, and `utf8`, and leave them out of the list.
Case each acronym or initialism inside a name as a word, such as `callbackUrl` and `HttpClient`, so no name with a lowercase letter holds two capitals in a row.
A name of capitals, digits, and underscores alone, such as the constant `MAX_URL_LENGTH`, cases every word alike and is allowed, except as a type's name, such as `URL`.
A word that a language itself defines, such as the name of a primitive type, is a word in that language, and that language's lint leaves it out.
Each unit suffix that the repository declares under `code-measured-value-names`, and the bound words `max` and `min` that it names, are words, and the list leaves them out.
Reading a name that another system declares, such as a base class's `this.ctx`, is not a declaration and is allowed.
Keep a declared name that another system fixes, such as an interface's method, a library option, a wire field, or a command-line flag, and suppress its finding as `code-lint-suppressions` requires, with a reason that names that system.
Keep the external name of a stored or shipped field that the repository owns, as `data-stored-and-shipped-formats` requires, through a serializer rename where one exists and otherwise with a suppressed finding.
Never remove a word from the list or exempt one name in the lint configuration to let a change pass; suppress that finding instead.
Run this contract's `assets/` rules with the repository's lint; they reject one-character type parameters, declared names that start with `get`, `fetch`, or `load`, and two capitals in a row.

Violation: `const orderDir = join(root, 'orders')` abbreviates `directory`, `orders.filter((o) => o.isPaid)` names an order with one letter, and `getInvoice`, `fetchInvoice`, and `readFirst<T>` use `get`, `fetch`, and `T`.
Allowed: `const orderDirectory = join(root, 'orders')`, `orders.filter((order) => order.isPaid)`, `readInvoice`, `readFirst<Row>`, an accessor `get total()`, and a constructor that reads its base class's `this.ctx`.
Violation: `callbackURL`, `parseJSON`, `HTTPClient`, and `XAxis` each put two capitals in a row, and `type URL = string` names a type in capitals.
Allowed: `callbackUrl`, `parseJson`, `HttpClient`, `HorizontalAxis`, `type Url = string`, the constant `MAX_URL_LENGTH`, and a call of a dependency's imported `parseURL`.
Violation: `computeTotal({ invoice })` maps `invoice.lines` with `(invoice) => invoice.total`, which declares the parameter's name `invoice` again.
Allowed: that callback names its parameter `line`, as in `(line) => line.total`.

## Checks

Run the repository's lint and this contract's `assets/` rules from the repository root on the changed files, and confirm they report no listed word, one-character name, or acronym.
Compare each language's lint configuration with the word list, and confirm each one holds `get`, `fetch`, `load`, and every other listed word that its language does not define.
For each compound name that a language's lint cannot split, does any of its words appear in the list?
Does each name a change declares case every acronym as a word, including one that a digit hides from the lint, such as `runE2E`?
Does a changed name use an abbreviation or spelling variant that the list lacks, and should the list gain it?
For each suppression of these rules that a change adds, does its reason name the system that fixes the name?
Does the change remove a word from the list or exempt a single name in the lint configuration?

## Local adaptations

The word replacements are `wordReplacements`, and the known acronyms are the word list `acronyms.txt` in the registry's `src/vocabulary`; ast-grep `spelled-out-names` rejects a declared name that holds a listed word, class fields and destructured local names included, through the generated utility `abbreviation`, which finds a word at a name's start in lower or Pascal case, after a lower-case letter, and in upper snake case. `dir` spells out as `folder`, since `directory` names only the `DirectoryObject` (NM-04), and `config` as `configuration` (NM-05).
Deviation (NM-05): a name that keeps an external system's own word, such as `configHome` for XDG's `XDG_CONFIG_HOME`, git's `GIT_CONFIG_NOSYSTEM`, Cloudflare's `GlobalProps` and Wrangler's migration key `new_sqlite_classes`, is listed in `externalNames`, which the generated utility `external-name` exempts. This replaces the sentence that never exempts one name in the lint configuration and suppresses its finding instead, since the standard keeps an external variable's own word.
oxlint `id-length` rejects a one-character name except `_`; `checkGeneric` is off, so a type parameter of one capital letter passes.
`args` and `params` are not on the list, because Node's `parseArgs`, `spawn` and the operation catalog's path parameters name them.
A finding's fix is `mise run rename -- <from> <to>`, which renames the binding and every reference to it through the compiler, rather than an ast-grep `fix:` with `transform`, which would rewrite the declaration it matches and leave each reference behind (NM-04, NM-05).

The v11 get/fetch/load renames, acronym casing, generic-name ban and additional shadowing requirements are outside the current adoption baseline at commit 94f2d0f.
The shipped assets stay unloaded until their naming migration establishes a baseline and preserves external interfaces.
The existing wordReplacements and id-length settings remain enforced, including their declared generic-parameter allowance.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `externalNames` `configHome`, `ConfigHome`, `CONFIG_HOME_FALLBACK`, `CONFIG_HOME_VARIABLE`, `GIT_CONFIG_NOSYSTEM`, `GlobalProps`, `new-cap`, `capIsNew`, `new_sqlite_classes`; `wordReplacements` `addr` address, `arr` array, `attr` attribute, `buf` buffer, `calc` calculation, `cb` callback, `cfg` configuration, `conf` configuration, `config` configuration, `configs` configurations, `ctx` context, `cur` current, `desc` description, `dir` folder, `dst` destination, `elem` element, `env` environment, `err` error, `evt` event, `ext` extension, `fn` function, `hdr` header, `idx` index, `impl` implementation, `len` length, `mgr` manager, `mod` module, `msg` message, `num` number, `obj` object, `op` operation, `opts` options, `org` organization, `pkg` package, `pos` position, `prev` previous, `proc` process, `prop` property, `props` properties, `ref` reference, `repo` repository, `req` request, `res` response, `resp` response, `ret` result, `seq` sequence, `sig` signature, `spec` specification, `src` source, `str` string, `tmp` temporary, `tx` transaction, `txn` transaction, `util` utility, `utils` utilities, `val` value.
- oxlint `id-length` (NM-06): enforced, `["error",{"min":2,"exceptions":["_"],"checkGeneric":false}]`
- oxlint `no-underscore-dangle` (029): enforced, `["error",{"allow":["_tag"]}]`
- ast-grep `spelled-out-names` (NM-05): enforced

<!-- End of the generated block. -->
