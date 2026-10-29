import type { ToolDiagnostic } from '@earendil-works/pi-durable';
import type { DiagnosticInput } from './types.ts';

/** An error the model reads beside the output. */
export function errorDiagnostic({ code, message }: DiagnosticInput): ToolDiagnostic {
  return { severity: 'error', code, message };
}
