import { SHA256_PATTERN, wireStruct } from '@mechane/records';
import { Effect, Record, Schema } from 'effect';
import { SANDBOX_TOOL_LIMITS, SANDBOX_TOOL_PROTOCOL, SandboxToolTarget } from './constants.ts';

const TOOL_TARGETS: ReadonlyArray<SandboxToolTarget> = Record.values(SandboxToolTarget);

const ToolName = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9-]*$/u),
  Schema.isMaxLength(SANDBOX_TOOL_LIMITS.maxNameChars),
);

const ToolVersion = Schema.NonEmptyString.check(Schema.isMaxLength(SANDBOX_TOOL_LIMITS.maxVersionChars));

const ToolVersionOutput = Schema.NonEmptyString.check(
  Schema.isMaxLength(SANDBOX_TOOL_LIMITS.maxVersionOutputChars),
  Schema.isPattern(/^[^\p{Cc}]+$/u),
);

const ToolUrl = Schema.URLFromString.check(
  Schema.makeFilter((url) => url.protocol === SANDBOX_TOOL_PROTOCOL, { expected: 'an HTTPS tool archive' }),
  Schema.makeFilter((url) => url.username === '' && url.password === '', {
    expected: 'a tool archive URL without credentials',
  }),
  Schema.makeFilter((url) => url.search === '' && url.hash === '', {
    expected: 'a tool archive URL without query or fragment',
  }),
  Schema.makeFilter((url) => url.href.length <= SANDBOX_TOOL_LIMITS.maxUrlChars, {
    expected: 'a bounded tool archive URL',
  }),
);

const ToolExecutable = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9_][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9_][a-zA-Z0-9._-]*)*$/u),
  Schema.isMaxLength(SANDBOX_TOOL_LIMITS.maxExecutableChars),
);

/** Only the declared regular file is read from the checksum-bound tar.xz archive. */
export const SandboxToolArchive = Schema.Struct({
  url: ToolUrl,
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  executable: ToolExecutable,
});

export type SandboxToolArchive = typeof SandboxToolArchive.Type;

const ToolTargets = Schema.Struct({
  [SandboxToolTarget.LinuxX64]: Schema.optionalKey(SandboxToolArchive),
  [SandboxToolTarget.LinuxArm64]: Schema.optionalKey(SandboxToolArchive),
  [SandboxToolTarget.DarwinArm64]: Schema.optionalKey(SandboxToolArchive),
}).check(
  Schema.makeFilter((targets) => TOOL_TARGETS.some((target) => Object.hasOwn(targets, target)), {
    expected: 'at least one tool target',
  }),
);

/** One installation-owned executable and the independently verified archive for each supported host. */
export const SandboxTool = wireStruct({
  fields: { name: ToolName, version: ToolVersion, versionOutput: ToolVersionOutput, targets: ToolTargets },
});

export type SandboxTool = typeof SandboxTool.Type;

/** A bounded manifest whose executable names cannot overwrite one another. */
export const SandboxTools = Schema.Array(SandboxTool).check(
  Schema.isMaxLength(SANDBOX_TOOL_LIMITS.maxEntries),
  Schema.makeFilter((tools) => new Set(tools.map((tool) => tool.name)).size === tools.length, {
    expected: 'tools with distinct executable names',
  }),
);

export type SandboxTools = typeof SandboxTools.Type;

/** The manifest's environment encoding; omitted configuration installs no additional tools. */
export const SandboxToolsVariable = Schema.fromJsonString(SandboxTools).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed('[]')),
);

export type SandboxToolsVariable = typeof SandboxToolsVariable.Type;
