export function admissionToken(runId: string): string {
  return `mechane-admission:${runId}`;
}
