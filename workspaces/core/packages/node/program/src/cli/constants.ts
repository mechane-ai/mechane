import { INSTALL_FOLDER_VARIABLE } from '@mechane/protocol';

/** The variables the CLI reads beside the origin, as its command reference lists them, and its installer's folder. */
export const CliVariable = {
  ApiKey: 'MECHANE_API_KEY',
  ConfigHome: 'XDG_CONFIG_HOME',
  InstallFolder: INSTALL_FOLDER_VARIABLE,
} as const;

/** The flags that make a command write its one result as a JSON envelope, or its records as JSON Lines. */
export const CliOutput = { Json: ['--output', 'json'], Lines: ['--output', 'jsonl'] } as const;
