import { uploadSessionEvidence } from './evidence-upload.ts';
import { runAssignedSandboxWork } from './run-worker-agent.ts';
import { loadWorkerAgentSettings } from './settings.ts';

async function main(): Promise<void> {
  const mode = loadWorkerAgentSettings();

  if (mode.kind === 'upload-evidence') {
    await uploadSessionEvidence(mode.upload);

    return;
  }

  await runAssignedSandboxWork(mode.lease);
}

await main();
