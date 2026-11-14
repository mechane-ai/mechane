/** The longest name a mech may have. */
export const MECH_NAME_MAX_CHARS = 64;

/** The longest instructions a mech may have. */
export const INSTRUCTIONS_MAX_CHARS = 65_536;

/** Whether the mech runs queued work, holds it, or also refuses incoming work while retaining history. */
export const MechStatus = { Active: 'active', Paused: 'paused', Archived: 'archived' } as const;

export type MechStatus = (typeof MechStatus)[keyof typeof MechStatus];

export const NativeTool = {
  Bash: 'bash',
  BashStatus: 'bash_status',
  ConsoleMessage: 'console_message',
  ExportEvidence: 'export_evidence',
  ReadToolResult: 'read_tool_result',
  StartProcess: 'start_process',
  ReadProcess: 'read_process',
  ListProcesses: 'list_processes',
  StopProcess: 'stop_process',
  BrowserTabs: 'browser_tabs',
  BrowserOpen: 'browser_open',
  BrowserClose: 'browser_close',
  BrowserNavigate: 'browser_navigate',
  BrowserObserve: 'browser_observe',
  BrowserClick: 'browser_click',
  BrowserType: 'browser_type',
  BrowserScroll: 'browser_scroll',
  BrowserKey: 'browser_key',
  BrowserScreenshot: 'browser_screenshot',
  BrowserRecordStart: 'browser_record_start',
  BrowserRecordStop: 'browser_record_stop',
  BrowserConsole: 'browser_console',
  BrowserNetwork: 'browser_network',
  BrowserStatus: 'browser_status',
} as const;
