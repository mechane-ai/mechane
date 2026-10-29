import type { ProgramSettings } from '@mechane/cli-kernel';
import { PROGRAM } from '@mechane/commands';
import { RELEASE, ReleaseStamp } from '@mechane/protocol';
import { Option, Schema } from 'effect';

/** What the runtime says of the running program: the stamp a release compiled into it, and its executable's path. */
type ProgramSettingsInput = { readonly stamp: unknown; readonly executablePath: string };

/**
 * The program the runtime runs. A release compiles its stamp into each binary, and a stamp that does not decode is a
 * defect of that release. Without one, the program reports the protocol's release and names `source` as its build.
 */
export function programSettings({ stamp, executablePath }: ProgramSettingsInput): ProgramSettings {
  const decoded = Schema.decodeUnknownSync(Schema.OptionFromUndefinedOr(ReleaseStamp))(stamp);

  if (Option.isNone(decoded)) {
    return { release: RELEASE, binary: Option.none(), userAgent: `${PROGRAM}/${RELEASE} (source)` };
  }

  const { release, target } = decoded.value;

  return {
    release,
    binary: Option.some({ target, path: executablePath }),
    userAgent: `${PROGRAM}/${release} (${target})`,
  };
}
